const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  text: { 
    type: String, 
    required: true 
  },
  btId: { 
    type: String, 
    required: true 
  },
  ghost: { 
    type: String, 
    required: true 
  },
  system: { 
    type: Boolean, 
    default: false 
  },
  color: { 
    type: String 
  },
  sentAt: { 
    type: Date, 
    default: Date.now,
    expires: 60 // ⚠️ THIS IS THE MAGIC! MongoDB will auto-delete this document 60 seconds after it is created.
  }
});

module.exports = mongoose.model('Message', messageSchema);