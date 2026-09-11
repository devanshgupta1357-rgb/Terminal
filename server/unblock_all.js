require('dotenv').config();
const mongoose = require('mongoose');
const BlockedUser = require('./models/BlockedUser');

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    const res = await BlockedUser.deleteMany({});
    console.log(`Unblocked ${res.deletedCount} users.`);
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
