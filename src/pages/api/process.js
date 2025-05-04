/**
 * pages/api/process.js
 *
 * – auto‑detects the header row (skips title rows)
 * – works with CSV or XLSX uploads
 * – logs useful diagnostics
 * – sanitizes form text to avoid WinAnsi encoding errors
 */

import { createRouter } from 'next-connect';
import multer from 'multer';
import XLSX from 'xlsx';
import { PDFDocument } from 'pdf-lib';
import AWS from 'aws-sdk';

// AWS + environment configuration
const s3 = new AWS.S3({ region: process.env.AWS_REGION });
const PDF_TEMPLATE_BUCKET = process.env.PDF_TEMPLATE_BUCKET;
const PDF_TEMPLATE_KEY = process.env.PDF_TEMPLATE_KEY || 'template.pdf';
const OUTPUT_BUCKET = process.env.OUTPUT_BUCKET;

// Helper: sanitize text for WinAnsi (replace subscripts, strip unsupported chars)
const SUBSCRIPT_MAP = {
  '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9'
};
function sanitizeForPdf (raw = '')
{
  return String(raw)
    .split('')
    .map(ch =>
    {
      if (SUBSCRIPT_MAP[ch]) return SUBSCRIPT_MAP[ch];
      const code = ch.charCodeAt(0);
      return code >= 32 && code <= 255 ? ch : '';
    })
    .join('');
}

// Wrapper to fill text fields safely
function fillText (form, fieldName, value)
{
  try
  {
    form.getTextField(fieldName).setText(sanitizeForPdf(value));
  } catch { }
}

// Multer and next-connect setup
const upload = multer({ storage: multer.memoryStorage() });
const router = createRouter();
export const config = { api: { bodyParser: false } };
router.use(upload.single('file'));

// Main handler
router.post(async (req, res) =>
{
  try
  {
    console.log('▶️  /api/process');
    console.log('   • file       :', req.file?.originalname);
    console.log('   • mime‑type  :', req.file?.mimetype);

    const {
      studentName,
      hospital,
      supervisor,
      clerkship,
      coursePrefix,
      date: selectedDate,
      userName = 'UnknownUser',
    } = req.body;

    // Read workbook (CSV or XLSX)
    let workbook;
    if (
      req.file.mimetype === 'text/csv' ||
      req.file.originalname.toLowerCase().endsWith('.csv')
    )
    {
      console.log('📄 CSV detected');
      workbook = XLSX.read(req.file.buffer.toString('utf8'), { type: 'string' });
    } else
    {
      console.log('📄 XLSX detected');
      workbook = XLSX.read(req.file.buffer, { type: 'buffer' });

      // Flatten dates by re-exporting to CSV
      const firstSheetName = workbook.SheetNames[0];
      const csv = XLSX.utils.sheet_to_csv(workbook.Sheets[firstSheetName]);
      workbook = XLSX.read(csv, { type: 'string' });
    }

    const worksheet = workbook.Sheets[workbook.SheetNames[0]];

    // Auto‑detect header row containing "Case Log type"
    const asArray = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
    const headerRowIdx = asArray.findIndex(row =>
      row.some(cell =>
        typeof cell === 'string' &&
        cell.trim().toLowerCase().startsWith('case log type')
      )
    );

    if (headerRowIdx === -1)
    {
      throw new Error('No “Case Log type: EPP / EPE” header found');
    }

    const rows = XLSX.utils.sheet_to_json(worksheet, {
      range: headerRowIdx,
      defval: '',
    });
    console.log('   • rows parsed:', rows.length);
    console.log('   • first row  :', rows[0]);

    // Fetch PDF template from S3
    const { Body: pdfTemplateBytes } = await s3
      .getObject({ Bucket: PDF_TEMPLATE_BUCKET, Key: PDF_TEMPLATE_KEY })
      .promise();

    // Iterate and generate PDFs
    let processed = 0;
    let skippedHeader = 0;
    let skippedEmpty = 0;

    for (const [idx, row] of rows.entries())
    {
      const caseLogField = row['Case Log type: EPP / EPE'];

      if (caseLogField == null)
      {
        skippedHeader++;
        console.warn(`⚠️  Row ${idx + 1}: missing “Case Log type” – skipped`);
        continue;
      }

      const caseLogValues = String(caseLogField)
        .split(',')
        .map(v => v.trim())
        .filter(Boolean);

      if (caseLogValues.length === 0)
      {
        skippedEmpty++;
        console.warn(`⚠️  Row ${idx + 1}: empty “Case Log type” – skipped`);
        continue;
      }

      for (const caseLogValue of caseLogValues)
      {
        const pdfDoc = await PDFDocument.load(pdfTemplateBytes);
        const form = pdfDoc.getForm();

        // Fill date fields
        ['DATES', 'DATES 2', 'DATES 3_af_date'].forEach(name =>
        {
          try { form.getTextField(name).setText(sanitizeForPdf(selectedDate)); } catch { }
        });

        // Fill text fields
        fillText(form, 'MRN', row['MRN / Patient ID']);
        fillText(form, 'STUDENT NAME', studentName);
        fillText(form, 'STUDENT NAME 2', studentName);
        fillText(form, 'HOSPITAL/CLINICAL SITE', hospital);
        fillText(form, 'SUPERVISING FACULTY', supervisor);
        fillText(form, 'CLERKSHIP NAME', clerkship);
        fillText(form, 'COURSE PREFIX', coursePrefix);
        fillText(form, 'CASE NAME 2', caseLogValue);
        fillText(form, 'CASE NAME.CASE NAME', caseLogValue);
        fillText(form, 'CASE SUMMARY', row['Case Summary']);

        // Checkboxes
        for (let i = 1; i <= 5; i++)
        {
          try { form.getCheckBox(`CheckEssentialEncounter${i}`).check(); } catch { }
        }

        const pdfBytes = await pdfDoc.save();

        // Upload to S3
        const key = `${userName}/CaseLog_${row['MRN / Patient ID'] || 'unknown'}_${caseLogValue || 'case'}.pdf`;
        await s3.putObject({
          Bucket: OUTPUT_BUCKET,
          Key: key,
          Body: pdfBytes,
          ContentType: 'application/pdf',
          Expires: new Date(Date.now() + 1000 * 60 * 5),
        }).promise();

        processed++;
      }
    }

    console.log('✅ PDFs created :', processed);
    console.log('🚫 Rows skipped :', { missingHeader: skippedHeader, emptyValue: skippedEmpty });

    return res.status(200).json({ message: `${processed} PDFs generated.` });
  } catch (err)
  {
    console.error('❌ Error:', err);
    return res.status(500).json({ error: err.message });
  }
});

export default router.handler();
