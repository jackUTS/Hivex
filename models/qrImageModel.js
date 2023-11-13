const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const qrCodeImageSchema = new Schema({
  filename: {
    type: String,
    unique: true,
},
  uploadDate: Date,
  // Other image-related fields
});

const QRCodeImage = mongoose.model('QRCodeImage', qrCodeImageSchema);

module.exports = QRCodeImage;
