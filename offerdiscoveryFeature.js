// Import necessary modules
const express = require('express'); // Import the Express.js framework
const mongoose = require('mongoose'); // Import the Mongoose library for MongoDB interactions
const nodemailer = require('nodemailer'); // Import the Nodemailer
const Coupon = require("../models/couponModel"); // Import the Coupon model 
const Member = require("../models/memberModel"); // Import the Member model
const Venue = require("../models/venueModel"); // Import the Venue model
const Deal = require("../models/dealModel"); // Import the Deal model
const currentMember = require("../middleware/current-member"); // Import middleware for current member
const currentVenue = require("../middleware/current-venue"); // Import middleware for current venue

// Define routes and logic for offer creation, approval, and distribution
// These routes can be used by brokers and venues as needed

// Create an offer by a broker
app.post('/create-offer', currentMember, asyncHandler(async (req, res) => {
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

    // Forward the request to the '/api/coupons' route, passing the relevant data to create a coupon
    req.body = {
      title,
      code,
      value,
      expiry,
    };

    await router.handle(req, res);
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' }); // Handle internal server errors
  }
}));

// Define a POST route for approving an offer with a dynamic parameter :couponId
app.post('/approve-offer/:couponId', currentVenue, async (req, res) => {
  try {
    const couponId = req.params.couponId; // Get the coupon ID from the request parameters

    // Check if the current user is a venue
    if (!req.currentVenue) {
      return res.status(403).json({ error: 'Only venues can approve offers' }); // Return a 403 Forbidden response
    }

    // Check if the coupon exists and belongs to the current venue
    const coupon = await Coupon.findOne({ _id: couponId, venueId: req.currentVenue.id });
    if (!coupon) {
      return res.status(404).json({ error: 'Coupon not found' }); // Return a 404 Not Found response if the coupon doesn't exist
    }

    // Mark the coupon as approved
    coupon.approved = true;

    // Save the updated coupon
    await coupon.save();

  // Now, update the Deal to set isActive to true
  const deal = await Deal.findOne({ _id: coupon.dealId });
  if (deal) {
    deal.isActive = true;
    await deal.save(); // Save the updated deal

    // Send the offer to all members
    await sendOfferToAllMembers(coupon);

    res.status(200).json({ message: 'Offer approved and sent to all members' }); // Respond with a 200 OK success message
  } else {
    // Handle the case where the deal associated with the coupon is not found
    return res.status(404).json({ error: 'Deal not found' }); // Return a 404 Not Found response
  }
} catch (error) {
  res.status(500).json({ error: 'Internal Server Error' }); // Handle and return a 500 Internal Server Error in case of an exception
}
});

// Function to send the offer to specified members using Nodemailer
async function sendOfferToMembers(memberIds, coupon) {
  try {
    // Fetch the specified members based on their IDs
    const members = await Member.find({ _id: { $in: memberIds } });

    // Create a Nodemailer transporter
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: 'hivex@gmail.com', // Replace with actual Gmail email address
        pass: 'hivex123', // Replace with your Gmail email password
      },
    });

    // Loop through each specified member and send the offer
    for (const member of members) {
      const mailOptions = {
        from: 'hivex@gmail.com',
        to: member.email,
        subject: 'New Offer Available',
        text: 'Dear ' + member.name + ',\n\n' +
          'A new offer is now available: ' + offer.title + ' (' + offer.code + ').\n\n' +
          'Details: ' + offer.value + ' off, expires on ' + offer.expiry + '.',
      };

      // Send the email
      await transporter.sendMail(mailOptions);
    }

    console.log('Offer sent to specified members successfully.');
  } catch (error) {
    console.error('Error sending offer to specified members:', error);
    // Handle the error as needed
  }
}

module.exports = router;

