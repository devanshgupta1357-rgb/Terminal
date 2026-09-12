const mongoose = require('mongoose');

const operatorSchema = new mongoose.Schema({
  btId: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String, // Hashed password
    required: true
  }
});

module.exports = mongoose.model('Operator', operatorSchema);
