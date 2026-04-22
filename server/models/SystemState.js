// models/SystemState.js
const mongoose = require('mongoose');

const systemStateSchema = new mongoose.Schema({
  isMuted: {
    type: Boolean,
    default: false
  },
  isLocked: {
    type: Boolean,
    default: false
  }
});

module.exports = mongoose.model('SystemState', systemStateSchema);