const { BadRequestError, NotFoundError } = require("@dqticket/common");
const express = require("express");
const nodemailer = require("nodemailer");
require("dotenv").config();

const asyncHandler = require("../middleware/asyncHandler");
const { currentVenue } = require("../middleware/current-venue");
const Deal = require("../models/dealModel");
const { currentMember } = require("../middleware/current-member");


const router = express.Router();

// Create deal
// POST /api/deals
router.post(
    "/",
    currentVenue,
    asyncHandler(async (req, res) => {
        const { title, totalCreated, value, expiry, description } = req.body;
        const venueId = req.currentVenue.id

        const existingDeal = await Deal.findOne({title, venueId})

        if (existingDeal){
            res.status(400).json({message: 'Deal title must be unique'});
        } else {
            const deal = await Deal.create({
                title,
                totalCreated,
                value,
                expiry,
                description,
                venueId: req.currentVenue.id,
                memberIds: "65050ae449718be08cde1cc4",
            });
            await deal.save();

            res.status(201).send(deal);
        }
    })
);

// get all Venue deals
// GET /api/deals
router.get(
    "/",
    currentVenue,
    asyncHandler(async (req, res) => {
        const deal = await Deal.find({
            venueId: req.currentVenue.id,
        });

        res.send(deal);
    })
);

// get all member deals
// GET /api/deals/mDeals
router.get(
    "/mDeals",
    currentMember,
    asyncHandler(async (req, res) => {
        const deal = await Deal.find({
            memberId: "65050ae449718be08cde1cc4",
        });

        res.send(deal);
    })
);

//get single deal
//GET /api/deals/:title
router.get(
    "/:title",
    currentVenue,
    asyncHandler(async (req, res) => {
        const title = req.params.title
        const deal = await Deal.findOne({title})

        if (!deal) {
            throw new NotFoundError()
        }
        if (deal.isInactive == false){
            throw new BadRequestError("Deal inactive")
        }
        else {
            res.send(deal)
        }
    })
);

// activate the deal
//POST /api/deals/activate
router.post(
    "/deals/activate",
    asyncHandler(async (req, res) => {
        const {title} = req.body

        try {
            const deal = await Deal.findOne({title})

            if (deal) {
                deal.isActive = true
                await deal.save()

                res.json({message: 'Deal activated successfully'})
            } else {
                res.status(400).json({message: 'Deal not found'})
            }
        } catch (err) {
            res.status(500).json({ message: 'Internal server error'})
        }
    })
);

// Discover a Deal (Member)
//POST /api/deals/sendDeal
router.post(
    "/deals/sendDeal",
    currentVenue,
    asyncHandler(async (req, res) => {
        
        try{
        const currentDeal = await Deal.findOne({_id: req.body.id});
        const memberIds = currentDeal.memberIds;
        const mebmers = await Member.find({_ID: {$in: memberIds}});

        const transporter = nodemailer.createTransport({
            service: process.env.HOST, // Replace with Mail Service (Gmail, Hotmail, etc.)
            auth: {
                user: process.env.USER, // Replace with actual Email Address
                pass: process.env.PASS, // Replace with Email password
            }
        });

        for (const member of members) {
            const mailOptions = {
                from: 'hivex@gmail.com',
                to: member.email,
                subject: 'New Deal Available!',
                text: 'Dear ' + member.name + ',\n\n' +
                'A new deal is now available: ' + currentDeal.title + '.\n\n' +
                'Deatils: ' + currentDeal.value + 'off, expires on ' + currentDeal.expiry + '.',
            };

            await transporter.sendMail(mailOptions);
        }

        console.log('Deal sent to specified members successfully.');
        } catch (error) {
            console.error('Error sending deal to specified members:', error);
        }
    })
);

module.exports = router