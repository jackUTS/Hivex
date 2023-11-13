const { validateRequest, BadRequestError } = require("@dqticket/common");
const express = require("express");
const { body } = require("express-validator");
const jwt = require("jsonwebtoken");
const axios = require('axios');
const mongoose = require("mongoose");

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
        const { name, address, email, password} = req.body;
        const existingVenue = await Venue.findOne({ email });

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
                password,
            });
            await venue.save();
            res.status(201).send({message: "Venue Added", venue: venue});

        } else {
            res.status(403).send({ message: 'Only brokers can add venues' });
        }
    })
);

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

module.exports = router;

/*<script src=
“https://maps.googleapis.com/maps/api/js?key=AIzaSyDbmf_oibOuPXvtR11eQJiFcvY148s_Aow&callback=initMap&libraries=&v=weekly”
async>
</script>*/
router.get("/location", currentVenue, (req, res) => {
    const apiKey = AIzaSyDbmf_oibOuPXvtR11eQJiFcvY148s_Aow

    const address = currentVenue.address

    if (!address) {
        return res.status(400).json({ error: 'Address parameter is missing'})
    }

    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`

    axios.get(url)
        .then(response => {
            const location = response.data.results[0].geometry.location
            res.json(location)
        })

})
