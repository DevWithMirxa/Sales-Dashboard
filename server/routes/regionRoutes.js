const express = require('express');
const router = express.Router();
const { createRegion, getRegions, updateRegion, deleteRegion } = require('../controllers/regionController');

router.route('/')
    .get(getRegions)
    .post(createRegion);

router.route('/:id')
    .put(updateRegion)
    .delete(deleteRegion);

module.exports = router;
