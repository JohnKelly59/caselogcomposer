// pages/api/process.js
import { createRouter } from 'next-connect';
import multer from 'multer';
import XLSX from 'xlsx';
import { PDFDocument } from 'pdf-lib';
import AWS from 'aws-sdk';

// Configure AWS S3
const s3 = new AWS.S3({
  region: process.env.AWS_REGION, // Ensure these environment variables are set.
});
const PDF_TEMPLATE_BUCKET = process.env.PDF_TEMPLATE_BUCKET; // e.g., "your-pdf-bucket"
const PDF_TEMPLATE_KEY = process.env.PDF_TEMPLATE_KEY || 'template.pdf';
const OUTPUT_BUCKET = process.env.OUTPUT_BUCKET; // Optional: bucket to store output PDFs

// Configure multer storage in memory
const upload = multer({ storage: multer.memoryStorage() });

// Create a router using next-connect v1.0.0 API.
const router = createRouter();

// Disable Next.js body parser so that multer can handle file uploads.
export const config = {
  api: { bodyParser: false },
};

// Use multer middleware to handle a single file under the field name "file".
router.use(upload.single('file'));

// POST handler
router.post(async (req, res) => {
  try {
    // Extract extra parameters from the request body.
    const studentName = req.body.studentName;
    const hospital = req.body.hospital;
    const supervisor = req.body.supervisor;
    const clerkship = req.body.clerkship;
    const coursePrefix = req.body.coursePrefix;
    const selectedDate = req.body.date; // Expected format: YYYY-MM-DD
    // Use the student name as the folder name for storing output PDFs.
    const userName = req.body.userName || "UnknownUser";
console.log("userName", userName);
    // Determine file type (CSV or XLSX) and create a workbook accordingly.
    let workbook;
    if (
      req.file.mimetype === "text/csv" ||
      req.file.originalname.toLowerCase().endsWith(".csv")
    ) {
      const csvData = req.file.buffer.toString('utf8');
      workbook = XLSX.read(csvData, { type: 'string' });
    } else {
      // Assume XLSX file.
      workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
      // Convert the first sheet to CSV for uniform parsing.
      const firstSheetName = workbook.SheetNames[0];
      const firstSheet = workbook.Sheets[firstSheetName];
      const csvData = XLSX.utils.sheet_to_csv(firstSheet);
      workbook = XLSX.read(csvData, { type: 'string' });
    }

    // Parse rows from the first sheet.
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(worksheet);

    // Download the PDF template from S3.
    const pdfTemplateResponse = await s3.getObject({
      Bucket: PDF_TEMPLATE_BUCKET,
      Key: PDF_TEMPLATE_KEY,
    }).promise();
    const pdfTemplateBytes = pdfTemplateResponse.Body;

    let processedCount = 0;

    // Process each row in the CSV.
    for (const row of rows) {
      // For each row, split the "Case Log type: EPP / EPE" field by comma.
      const caseLogField = row["Case Log type: EPP / EPE"];
      if (!caseLogField) {
        continue;
      }
      // Split the value on commas.
      const caseLogValues = caseLogField.split(",").map(val => val.trim()).filter(Boolean);
      if (caseLogValues.length === 0) continue;

      // Process each case log value separately.
      for (const caseLogValue of caseLogValues) {
        // Load a new PDF document instance from the template.
        const pdfDoc = await PDFDocument.load(pdfTemplateBytes);
        const form = pdfDoc.getForm();

        // Set the provided date on all relevant date fields.
        const dateToUse = selectedDate; // Expected in YYYY-MM-DD format.
        const dateFields = ['DATES', 'DATES 2', 'DATES 3_af_date']; // Update these names as needed.
        dateFields.forEach(fieldName => {
          try {
            form.getTextField(fieldName).setText(dateToUse);
          } catch (err) {
            console.warn(`Field "${fieldName}" not found in the PDF template.`);
          }
        });

        // Set the Medical Record Number (or other fields, if applicable).
        // In this example, we're not splitting the MRN field; you can adjust accordingly.
        try {
          form.getTextField('MRN').setText(String(row['MRN / Patient ID'] || ''));
        } catch (err) {
          console.warn('Field "MRN" not found in the PDF template.');
        }

        // Check the five checkboxes for "Essential Patient Encounter / Essential Patient Procedure".
        for (let i = 1; i <= 5; i++) {
          try {
            const checkbox = form.getCheckBox(`CheckEssentialEncounter${i}`);
            if (checkbox) checkbox.check();
          } catch (err) {
            console.warn(`Could not find checkbox "CheckEssentialEncounter${i}"`);
          }
        }

        // Fill additional form fields with provided parameters.
        try { form.getTextField('STUDENT NAME').setText(studentName); } catch (err) { console.warn('Field "STUDENT NAME" not found.'); }
        try { form.getTextField('STUDENT NAME 2').setText(studentName); } catch (err) { console.warn('Field "STUDENT NAME 2" not found.'); }
        try { form.getTextField('HOSPITAL/CLINICAL SITE').setText(hospital); } catch (err) { console.warn('Field "HOSPITAL/CLINICAL SITE" not found.'); }
        try { form.getTextField('SUPERVISING FACULTY').setText(supervisor); } catch (err) { console.warn('Field "SUPERVISING FACULTY" not found.'); }
        try { form.getTextField('CLERKSHIP NAME').setText(clerkship); } catch (err) { console.warn('Field "CLERKSHIP NAME" not found.'); }
        try { form.getTextField('COURSE PREFIX').setText(coursePrefix); } catch (err) { console.warn('Field "COURSE PREFIX" not found.'); }

        // Fill fields from CSV row data.
        try { form.getTextField('CASE NAME 2').setText(caseLogValue); } catch (err) { console.warn('Field "CASE NAME 2" not found.'); }
        try { form.getTextField('CASE NAME.CASE NAME').setText(caseLogValue); } catch (err) { console.warn('Field "CASE NAME.CASE NAME" not found.'); }
        try { form.getTextField('CASE SUMMARY').setText(String(row["Case Summary"] || '')); } catch (err) { console.warn('Field "CASE SUMMARY" not found.'); }

        // Save the modified PDF to a byte array.
        const filledPdfBytes = await pdfDoc.save();

        // Define an output key for the generated PDF.
        // The file is stored under a folder named after the user.
        const outputKey = `${userName}/CaseLog_${row['MRN / Patient ID'] || 'unknown'}_${caseLogValue || 'case'}.pdf`;

        // Upload the generated PDF to S3.
        // Here, we set an Expires header 5 minutes in the future.
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

// Export the router's handler as the default export for the API route.
export default router.handler();
