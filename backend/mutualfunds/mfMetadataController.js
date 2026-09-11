const pool = require('./db');

const RISK_VALUES = ['Low', 'Low to Moderate', 'Moderate', 'Moderately High', 'High', 'Very High'];

function normalizeRisk(value) {
  if (!value) return null;
  const v = String(value).trim().toLowerCase().replace(/[_-]+/g, ' ');
  if (v === 'low') return 'Low';
  if (v === 'low to moderate' || v === 'moderately low') return 'Low to Moderate';
  if (v === 'moderate') return 'Moderate';
  if (v === 'moderately high') return 'Moderately High';
  if (v === 'high') return 'High';
  if (v === 'very high') return 'Very High';
  return null;
}

async function importMetadata(req, res) {
  const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
  if (!rows.length) return res.status(400).json({ success: false, message: 'rows[] is required' });

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    let updated = 0;
    let skipped = 0;
    for (const row of rows) {
      const schemeCode = Number(row.schemeCode ?? row.scheme_code);
      const rating = row.rating === null || row.rating === undefined || row.rating === '' ? null : Number(row.rating);
      const risk = normalizeRisk(row.risk);
      if (!Number.isInteger(schemeCode) || schemeCode <= 0 || (rating !== null && (!Number.isInteger(rating) || rating < 1 || rating > 5)) || (risk !== null && !RISK_VALUES.includes(risk))) {
        skipped++;
        continue;
      }
      const [result] = await connection.query(
        `UPDATE mf_schemes SET
          rating = COALESCE(?, rating),
          rating_source = COALESCE(?, rating_source),
          rating_updated_at = CASE WHEN ? IS NULL THEN rating_updated_at ELSE NOW() END,
          risk = COALESCE(?, risk),
          risk_source = COALESCE(?, risk_source),
          risk_updated_at = CASE WHEN ? IS NULL THEN risk_updated_at ELSE NOW() END,
          updated_at = NOW()
         WHERE scheme_code = ? AND is_active = 1`,
        [rating, row.ratingSource || 'VALUE_RESEARCH', rating, risk, row.riskSource || 'AMFI', risk, schemeCode]
      );
      if (result.affectedRows) updated += result.affectedRows; else skipped++;
    }
    await connection.commit();
    res.json({ success: true, data: { received: rows.length, updated, skipped } });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({ success: false, message: 'Metadata import failed', error: error.message });
  } finally {
    connection.release();
  }
}

module.exports = { importMetadata };
