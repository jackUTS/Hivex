const { validateRequest, BadRequestError } = require("@dqticket/common");
const express = require("express");
const { body } = require("express-validator");
const jwt = require("jsonwebtoken");
const axios = require('axios');
const mongoose = require("mongoose");
const otplib = require("otplib");

const asyncHandler = require("../middleware/asyncHandler");
const { currentVenue } = require("../middleware/current-venue");
const Venue = require("../models/venueModel");
const { currentMember } = require("../middleware/current-member");


const router = express.Router();

// get all venues for Brokers
// GET api/venues
router.get(
    "/",
    currentMember,
    asyncHandler(async (req, res) => {
        if(req.currentMember.isBroker) {
            const venues = await Venue.find({});
            res.send(venues);
        } else {
            throw new BadRequestError("Only brokers can view all venues");
        }
    })
);

// Sign up
// POST /api/venues/signup
router.post(
    "/signup",
    [
        body("email").isEmail().withMessage("Email must be valid"),
        body("password")
            .trim()
            .isLength({ min: 3, max: 20 })
            .withMessage("Password must be between 3 and 20 characters"),
    ],
    validateRequest,
    asyncHandler(async (req, res) => {
        const { name, address, email, password } = req.body;
        const existingVenue = await Venue.findOne({ email });

        if (existingVenue) {
            console.log("Email in use");
            throw new BadRequestError("Email in use");
        }

        const venue = await Venue.create({
            name,
            address,
            email,
            password,
        });
        await venue.save();

        // Generate JWT
        const venueJwt = jwt.sign(
            { id: venue.id, email: venue.email },
            process.env.JWT_KEY
        );

        // Store it on session object
        req.session = {
            jwt: venueJwt,
        };

        res.status(201).send(venue);
    })
);

//Add Venue as Broker
//POST /api/venues/add-venue
router.post(
    "/add-venue",
    [
        body("email").isEmail().withMessage("Email must be valid"),
        body("password")
            .trim()
            .isLength({ min: 3, max: 20 })
            .withMessage("Password must be between 3 and 20 characters"),
    ],
    validateRequest,
    currentMember,
    asyncHandler(async (req, res) => {
        const { name, address, email} = req.body;
        const existingVenue = await Venue.findOne({ email });
        const secret = 'secret-key';

        const otp = otplib.authenticator.generate(secret);
        console.log("OTP: ", otp);

        if(req.currentMember.isBroker === false) {
            throw new BadRequestError("You must be logged in as a broker to add a venue");
        }
        if (existingVenue) {
            throw new BadRequestError("Email in use");
        }
        if (req.currentMember.isBroker === true) {
            const venue = await Venue.create({
                venue_id: new mongoose.Types.ObjectId(),
                name,
                address,
                email,
                password: otp,
            });
            await venue.save();
            res.status(201).send({message: "Venue Added", venue: venue});

        } else {
            res.status(403).send({ message: 'Only brokers can add venues' });
        }
    })
);

// Venue Registration Link
//POST /api/venues/register
router.post("/register", async (req, res) => {
    const {email} = req.body
    try {
        const venue = await Venue.findOne({ email })
        if (!venue) {
            return res.status(404).json({ message: 'Venue not found'})
        }

        const registerToken = crypto.randomBytes(20).toString('hex')
        const tokenExpiration = new Date(Date.now() + 3600000)
        venue.resetToken = resetToken
        venue.tokenExpiration = tokenExpiration
        await venue.save()

        //Send email with reset link
        const resetLink = `localhost:3000/api/venues/register/${resetToken}`;
        const mailOptions = {
            from: process.env.USER,
            to: venue.email,
            subject: 'Venue Registration',
            text: `Click the following link to register your account: ${resetLink}`,
        };

        await transporter.sendMail(mailOptions);

    } catch (err) {
        console.error(err)
        res.status(500).json({ message: 'Internal Server Error'})
    }
});

//Confirm Venue Registration (via the link)
//GET /api/venues/register/:token
router.get('/register/:token', async (req, res) => {
    const token = req.params.token
    try {
        const venue = await Venue.findOne({
            resetToken: token,
            tokenExpiration: { $gt: new Date()}
        })

        if (!venue) {
            return res.status(404).json({ message: 'Invalid or expired token'})
        }
    } catch (err) {
        console.error(err)
        res.status(500).json({ message: 'Internal Server Error'})
    }
});

//Handle venue registration after confirmation
//POST /api/venues/register/confirm
router.post('/register/confirm', async (req, res) =>{
    const {token, newPassword} = req.body
    try {
        const venue = await Venue.findOne({
            resetToken: token,
            tokenExpiration: {$gt: new Date()},
        })

        if (!venue) {
            return res.status(404).json({message: 'Invalid or expired token'})
        }

        venue.password = newPassword

        venue.resetToken = undefined
        venue.tokenExpiration = undefined

        await venue.save()
        res.json({message: 'Venue registration completed successfully'})
    } catch (err) {
        console.error(err)
        res.status(500).json({message: 'Internal Server Error'})
    }
});

// Delete venue as Broker
// Post /api/venues/delete-venue
router.post(
    "/delete-venue",
    [
        body("email").isEmail().withMessage("Email must be valid"),
    ],
    validateRequest,
    currentMember,
    asyncHandler(async (req, res) => {
        const email = req.body.email;
        const existingVenue = await Venue.findOne({ email });

        if(req.currentMember.isBroker === false) {
            throw new BadRequestError("You must be logged in as a broker to add a venue");
        }

        if (!existingVenue) {
            throw new BadRequestError("Venue not found");
        }
        if(req.currentMember.isBroker === true) {

            await existingVenue.remove();

            res.status(201).send({ message: "Venue Deleted", venue: existingVenue });
        } 
        else {
            res.status(403).send({ message: 'Only brokers can delete venues' });
        }
    })
);

// Update venue
// POST /api/venues/update-venue
router.post(
    "/update-venue",
    currentVenue,
    asyncHandler(async (req, res) => {
        const venueId = req.currentVenue.id;
        const venue = await Venue.findById(venueId);
        const { name, address, email, password } = req.body;

        if (!venue) {
            throw new BadRequestError("Venue not found");
        }

        venue.name = name || venue.name;
        venue.address = address || venue.address;
        venue.email = email || venue.email;
        venue.password = password || venue.password;

        await venue.save();

        res.status(201).send(venue);
    })
)
// Sumbit Review as Member
// POST /api/venues/:venueId/reviews
router.post('/:venueId/reviews', 
    [
        body("review")
            .isLength({ min: 5, max: 300 })
            .withMessage("Review must be between 5 and 300 characters"),
    ],
    validateRequest,
    currentMember, 
    async (req, res) => {
    const venue = await Venue.findById(req.params.venueId);

    if (!venue) {
        return res.status(404).json({ message: 'Venue not found' });
    }
    if(req.currentMember) {
        const { review } = req.body;
    
        const newReview = {
            memberName: `${req.currentMember.firstName} ${req.currentMember.lastName}`,
            venueName: venue.name,
            review
        };
    
        venue.reviews.push(newReview);
        await venue.save();
        res.status(201).json(venue);
    }
    else {
        res.status(403).send({ message: 'Only members can add reviews' });
    }
});

// Get all reviews as Venue
// GET /api/venues/reviews
router.get(
    "/reviews",
    currentVenue,
    asyncHandler(async (req, res) => {

        const venue = await Venue.findById(req.currentVenue.id);

        if (!venue) {
            return res.status(404).send({ message: 'Venue not found' });
        }
        
        res.status(200).send(venue.reviews);
    })
);

// Sign in
// POST /api/venues/signin
router.post(
    "/signin",
    [
        body("email").isEmail().withMessage("Email must be valid"),
        body("password")
            .trim()
            .notEmpty()
            .withMessage("You must supply a password"),
    ],
    validateRequest,
    asyncHandler(async (req, res) => {
        const { email, password } = req.body;

        const existingVenue = await Venue.findOne({ email });
        if (!existingVenue) {
            throw new BadRequestError("Invalid credentials");
        }

        const passwordsMatch = await existingVenue.matchPassword(password);

        if (!passwordsMatch) {
            throw new BadRequestError("Invalid credentials");
        }

        // Generate JWT
        const venueJwt = jwt.sign(
            {
                id: existingVenue.id,
                email: existingVenue.email,
            },
            process.env.JWT_KEY
        );

        // Store it on session object
        req.session = {
            jwt: venueJwt,
        };

        res.status(200).send(existingVenue);
    })
);

// Sign out
// POST /api/venues/signout
router.post("/signout", (req, res) => {
    req.session = null;

    res.send("Signed Out");
});

// Current user
// GET /api/venues/profile
router.get("/profile", currentVenue, (req, res) => {
    res.send({ currentVenue: req.currentVenue || null });
});

// Leave Review
//GET /api/venues/review
router.post("/review", 
currentMember,
currentVenue,
asyncHandler(async (req, res) => {
    try {
    const {memberName, venueName, review} = req.body;

    const venueId = req.currentVenue.id;
    const venue = await Venue.findById(venueId);

    const newReview = {
        memberName: req.currentMember.name,
        venueName: venue.name,
        review,
    };

    venue.review.push(newReview);
    await venue.save();

    res.status(201).json(newReview);
    } catch (error) {
        res.status(500).json({ message: 'Internal Server Error!'})
    }
})
)

module.exports = router;
