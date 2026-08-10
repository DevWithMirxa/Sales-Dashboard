const express = require('express');
const router = express.Router();
const { createCustomer, getCustomers, updateCustomer, deleteCustomer } = require('../controllers/customerController');

router.route('/')
    .get(getCustomers)
    .post(createCustomer);

router.route('/:id')
    .put(updateCustomer)
    .delete(deleteCustomer);

module.exports = router;
