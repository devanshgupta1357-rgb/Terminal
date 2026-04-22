// models/BlockedUser.js
const mongoose = require('mongoose');

const blockedUserSchema = new mongoose.Schema({
  btId: {
    type: String,
    required: true,
    unique: true
  },
  blockedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('BlockedUser', blockedUserSchema);