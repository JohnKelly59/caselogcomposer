import { createRouter } from 'next-connect';
import multer from 'multer';
import XLSX from 'xlsx';
import { PDFDocument } from 'pdf-lib';
import AWS from 'aws-sdk';

const s3 = new AWS.S3({
  region: process.env.AWS_REGION,
});
const PDF_TEMPLATE_BUCKET = process.env.PDF_TEMPLATE_BUCKET;
const PDF_TEMPLATE_KEY = process.env.PDF_TEMPLATE_KEY || 'template.pdf';
const OUTPUT_BUCKET = process.env.OUTPUT_BUCKET;

const upload = multer({ storage: multer.memoryStorage() });

const router = createRouter();

export const config = {
  api: { bodyParser: false },
};

router.use(upload.single('file'));

router.post(async (req, res) => {
  try {
    const studentName = req.body.studentName;
    const hospital = req.body.hospital;
    const supervisor = req.body.supervisor;
    const clerkship = req.body.clerkship;
    const coursePrefix = req.body.coursePrefix;
    const selectedDate = req.body.date;
    const userName = req.body.userName || "UnknownUser";

    let workbook;
    if (
      req.file.mimetype === "text/csv" ||
      req.file.originalname.toLowerCase().endsWith(".csv")
    ) {
      const csvData = req.file.buffer.toString('utf8');
      workbook = XLSX.read(csvData, { type: 'string' });
    } else {
      workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
      const firstSheetName = workbook.SheetNames[0];
      const firstSheet = workbook.Sheets[firstSheetName];
      const csvData = XLSX.utils.sheet_to_csv(firstSheet);
      workbook = XLSX.read(csvData, { type: 'string' });
    }

    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(worksheet);

    const pdfTemplateResponse = await s3.getObject({
      Bucket: PDF_TEMPLATE_BUCKET,
      Key: PDF_TEMPLATE_KEY,
    }).promise();
    const pdfTemplateBytes = pdfTemplateResponse.Body;

    let processedCount = 0;

    for (const row of rows) {
      const caseLogField = row["Case Log type: EPP / EPE"];
      if (!caseLogField) {
        continue;
      }
      const caseLogValues = caseLogField.split(",").map(val => val.trim()).filter(Boolean);
      if (caseLogValues.length === 0) continue;

      for (const caseLogValue of caseLogValues) {
        const pdfDoc = await PDFDocument.load(pdfTemplateBytes);
        const form = pdfDoc.getForm();

        const dateToUse = selectedDate;
        const dateFields = ['DATES', 'DATES 2', 'DATES 3_af_date'];
        dateFields.forEach(fieldName => {
          try {
            form.getTextField(fieldName).setText(dateToUse);
          } catch (err) {}
        });

        try {
          form.getTextField('MRN').setText(String(row['MRN / Patient ID'] || ''));
        } catch (err) {}

        for (let i = 1; i <= 5; i++) {
          try {
            const checkbox = form.getCheckBox(`CheckEssentialEncounter${i}`);
            if (checkbox) checkbox.check();
          } catch (err) {}
        }

        try { form.getTextField('STUDENT NAME').setText(studentName); } catch (err) {}
        try { form.getTextField('STUDENT NAME 2').setText(studentName); } catch (err) {}
        try { form.getTextField('HOSPITAL/CLINICAL SITE').setText(hospital); } catch (err) {}
        try { form.getTextField('SUPERVISING FACULTY').setText(supervisor); } catch (err) {}
        try { form.getTextField('CLERKSHIP NAME').setText(clerkship); } catch (err) {}
        try { form.getTextField('COURSE PREFIX').setText(coursePrefix); } catch (err) {}

        try { form.getTextField('CASE NAME 2').setText(caseLogValue); } catch (err) {}
        try { form.getTextField('CASE NAME.CASE NAME').setText(caseLogValue); } catch (err) {}
        try { form.getTextField('CASE SUMMARY').setText(String(row["Case Summary"] || '')); } catch (err) {}

        const filledPdfBytes = await pdfDoc.save();

        const outputKey = `${userName}/CaseLog_${row['MRN / Patient ID'] || 'unknown'}_${caseLogValue || 'case'}.pdf`;

        const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
        if (OUTPUT_BUCKET) {
          await s3.putObject({
            Bucket: OUTPUT_BUCKET,
            Key: outputKey,
            Body: filledPdfBytes,
            ContentType: 'application/pdf',
            Expires: expiresAt,
          }).promise();
        }
        processedCount++;
      }
    }

    return res.status(200).json({ message: `${processedCount} case logs processed and PDFs generated.` });
  } catch (error) {
    console.error('Error processing file:', error);
    return res.status(500).json({ error: error.message });
  }
});

export default router.handler();
