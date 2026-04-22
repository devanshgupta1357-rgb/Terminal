// models/Report.js
const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  reporterBtId: String,
  reporterGhost: String,
  reportedBtId: String,
  reportedGhost: String,
  msgText: String,
  reason: String,
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Report', reportSchema);