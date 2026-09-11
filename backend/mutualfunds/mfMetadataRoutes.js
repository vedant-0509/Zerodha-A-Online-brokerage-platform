const express = require('express');
const { importMetadata } = require('./mfMetadataController');
const router = express.Router();
router.post('/import', importMetadata);
module.exports = router;
