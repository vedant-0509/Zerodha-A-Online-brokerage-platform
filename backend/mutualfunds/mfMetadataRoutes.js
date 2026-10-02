const express = require('express');
const { importMetadata } = require('./mfMetadataController');
const authenticateToken = require('../middleware/authenticateToken');
const requireRole = require('../middleware/requireRole');

const router = express.Router();

router.post('/import', authenticateToken, requireRole('ADMIN'), importMetadata);

module.exports = router;
