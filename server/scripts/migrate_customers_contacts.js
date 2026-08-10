require('dotenv').config();
const connectDB = require('../config/db');
const Customer = require('../models/Customer');

const migrate = async () => {
  await connectDB();
  try {
    const query = {
      $or: [
        { contacts: { $exists: false } },
        { contacts: { $size: 0 } }
      ],
      $or: [
        { personName: { $exists: true, $ne: null, $ne: '' } },
        { mobile: { $exists: true, $ne: null, $ne: '' } },
        { email: { $exists: true, $ne: null, $ne: '' } }
      ]
    };

    const docs = await Customer.find(query).lean();
    console.log(`Found ${docs.length} documents to migrate`);
    let updated = 0;
    for (const doc of docs) {
      const contacts = [];
      if (doc.personName || doc.mobile || doc.email) {
        contacts.push({
          name: doc.personName || '',
          designation: doc.designation || '',
          department: doc.department || '',
          mobile: doc.mobile || '',
          landline: doc.landline || '',
          email: doc.email || '',
          primary: true
        });
      }
      if (contacts.length) {
        await Customer.updateOne({ _id: doc._id }, { $set: { contacts } });
        updated++;
      }
    }
    console.log(`Migration complete. Updated ${updated} documents.`);
    process.exit(0);
  } catch (err) {
    console.error('Migration error', err);
    process.exit(1);
  }
};

migrate();
