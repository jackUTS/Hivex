// Import necessary modules
const express = require('express'); // Import the Express.js framework
const mongoose = require('mongoose'); // Import the Mongoose library for MongoDB interactions
const Coupon = require("../models/couponModel"); // Import the Coupon model 
const Member = require("../models/memberModel"); // Import the Member model
const Venue = require("../models/venueModel"); // Import the Venue model
const currentMember = require("../middleware/current-member"); // Import middleware for current member
const currentVenue = require("../middleware/current-venue"); // Import middleware for current venue

// Connect to the MongoDB database 
mongoose.connect('mongodb://localhost:27017/hivex', {
  useNewUrlParser: true, // Configuration option for MongoDB connection
  useUnifiedTopology: true, // Configuration option for MongoDB connection
  useCreateIndex: true, // Configuration option for MongoDB connection
});

// Create an Express application
const app = express(); // Create an instance of the Express application
app.use(express.json()); // Use middleware to parse JSON data in requests

// Define routes and logic for offer creation, approval, and distribution
// These routes can be used by brokers and venues as needed

// Create an offer by a broker
app.post('/create-offer', currentMember, async (req, res) => {
  try {
    const { title, code, value, expiry, memberId, venueId } = req.body; // Extract request data

    // Check if the current user is a broker
    if (!req.currentMember.isBroker) { // Check the current member's role
      return res.status(403).json({ error: 'Only brokers can create offers' }); // Return an error response
    }

    // Check if the venue exists
    const venue = await Venue.findById(venueId); // Find a venue by its ID
    if (!venue) {
      return res.status(404).json({ error: 'Venue not found' }); // Return an error response if the venue doesn't exist
    }

    // Create a new coupon offer
    const coupon = await Coupon.create({
      title,
      code,
      value,
      expiry,
      memberId,
      venueId,
    });

    res.status(201).json(coupon); // Respond with the created coupon
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' }); // Handle internal server errors
  }
});

// Approve an offer by the venue
app.post('/approve-offer/:couponId', currentVenue, async (req, res) => {
  try {
    const couponId = req.params.couponId; // Get the coupon ID from the request parameters

    // Check if the current user is a venue
    if (!req.currentVenue) { // Check the current venue's presence
      return res.status(403).json({ error: 'Only venues can approve offers' }); // Return an error response
    }

    // Check if the coupon exists and belongs to the current venue
    const coupon = await Coupon.findOne({ _id: couponId, venueId: req.currentVenue.id });
    if (!coupon) {
      return res.status(404).json({ error: 'Coupon not found' }); // Return an error response if the coupon doesn't exist
    }

    coupon.approved = true; // Mark the coupon as approved

    await coupon.save(); // Save the updated coupon

    res.status(200).json({ message: 'Offer approved' }); // Respond with a success message
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' }); // Handle internal server errors
  }
});

// Distribute offers to selected members
app.post('/distribute-offer/:couponId', currentMember, async (req, res) => {
  try {
    const couponId = req.params.couponId; // Get the coupon ID from the request parameters

    // Check if the current user is a broker
    if (!req.currentMember.isBroker) { // Check the current member's role
      return res.status(403).json({ error: 'Only brokers can distribute offers' }); // Return an error response
    }

    // Check if the coupon exists and belongs to the current member (broker)
    const coupon = await Coupon.findOne({ _id: couponId, memberId: req.currentMember.id });
    if (!coupon) {
      return res.status(404).json({ error: 'Coupon not found' }); // Return an error response if the coupon doesn't exist
    }

    // Send the coupon to selected members via email or push notifications

    res.status(200).json({ message: 'Offer distributed to selected members' }); // Respond with a success message
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' }); // Handle internal server errors
  }
});
