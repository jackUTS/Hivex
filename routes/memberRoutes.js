const { validateRequest, BadRequestError } = require("@dqticket/common");
const express = require("express");
const { body } = require("express-validator");
const jwt = require("jsonwebtoken");

const asyncHandler = require("../middleware/asyncHandler");
const { currentMember } = require("../middleware/current-member");
const Member = require("../models/memberModel");
const Coupon = require("../models/couponModel");
const crypto = require('crypto');

const router = express.Router();

// Sign up
// POST /api/members/signup
router.post(
    "/members/signup",
    [
        body("email").isEmail().withMessage("Email must be valid"),
        body("password")
            .trim()
            .isLength({ min: 3, max: 20 })
            .withMessage("Password must be between 3 and 20 characters"),
    ],
    validateRequest,
    asyncHandler(async (req, res) => {
        const { firstName, lastName, email, password } = req.body;
        const existingMember = await Member.findOne({ email });

        if (existingMember) {
            console.log("Email in use");
            throw new BadRequestError("Email in use");
        }

        const member = await Member.create({
            firstName,
            lastName,
            email,
            password,
        });
        await member.save();

        // Generate JWT
        const memberJwt = jwt.sign(
            { id: member.id, email: member.email },
            process.env.JWT_KEY
        );

        // Store it on session object
        req.session = {
            jwt: memberJwt,
        };

        res.status(201).send(member);
    })
);

// Sign up (broker)
// POST /api/brokers/signup
router.post(
    "/brokers/signup",
    [
        body("email").isEmail().withMessage("Email must be valid"),
        body("password")
            .trim()
            .isLength({ min: 3, max: 20 })
            .withMessage("Password must be between 3 and 20 characters"),
    ],
    validateRequest,
    asyncHandler(async (req, res) => {
        const { firstName, lastName, email, password } = req.body;
        const existingMember = await Member.findOne({ email });

        if (existingMember) {
            console.log("Email in use");
            throw new BadRequestError("Email in use");
        }

        const member = await Member.create({
            firstName,
            lastName,
            email,
            password,
            isBroker: true,
        });
        await member.save();

        // Generate JWT
        const memberJwt = jwt.sign(
            { id: member.id, email: member.email },
            process.env.JWT_KEY
        );

        // Store it on session object
        req.session = {
            jwt: memberJwt,
        };

        res.status(201).send(member);
    })
);

// Sign in
// POST /api/members/signin
router.post(
    "/members/signin",
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

        const existingMember = await Member.findOne({ email });
        if (!existingMember) {
            throw new BadRequestError("Invalid credentials");
        }

        const passwordsMatch = await existingMember.matchPassword(password);

        if (!passwordsMatch) {
            throw new BadRequestError("Invalid credentials");
        }

        // Generate JWT
        const userJwt = jwt.sign(
            {
                id: existingMember.id,
                email: existingMember.email,
            },
            process.env.JWT_KEY
        );

        // Store it on session object
        req.session = {
            jwt: userJwt,
        };

        res.status(200).send(existingMember);
    })
);

//Forgot Password
//POST /api/members/reset
router.post("/members/reset", async (req, res) => {
    const {email} = req.body
    try {
        const user = await Member.findOne({ email })
        if (!user) {
            return res.status(404).json({ message: 'User no found'})
        }

        const resetToken = crypto.randomBytes(20).toString('hex')
        const tokenExpiration = new Date(Date.now() + 3600000)
        user.resetToken = resetToken
        user.tokenExpiration = tokenExpiration
        await user.save()

    } catch (err) {
        console.error(err)
        res.status(500).json({ message: 'Internal Server Error'})
    }
})

//Confirm password reset (via the link)
//GET /api/members/reset/:token
router.get('/members/reset/:token', async (req, res) => {
    const token = req.params.token
    try {
        const user = await Member.findOne({
            resetToken: token,
            tokenExpiration: { $gt: new Date()}
        })

        if (!user) {
            return res.status(404).json({ message: 'Invalid or expired token'})
        }
    } catch (err) {
        console.error(err)
        res.status(500).json({ message: 'Internal Server Error'})
    }
})

//Handle password update after confirmation
//POST /api/members/reset/confirm
router.post('/members/reset/confirm', async (req, res) =>{
    const {token, newPassword} = req.body
    try {
        const user = await Member.findOne({
            resetToken: token,
            tokenExpiration: {$gt: new Date()},
        })

        if (!user) {
            return res.status(404).json({message: 'Invalid or expired token'})
        }

        user.password = newPassword

        user.resetToken = undefined
        user.tokenExpiration = undefined

        await user.save()
        res.json({message: 'Password reset successfully'})
    } catch (err) {
        console.error(err)
        res.status(500).json({message: 'Internal Server Error'})
    }
})

// Sign out
// POST /api/members/signout
router.post("/members/signout", (req, res) => {
    req.session = null;

    res.send("Signed Out");
});

// Current user
// GET /api/members/profile
router.get("/members/profile", currentMember, (req, res) => {
    res.send({ currentMember: req.currentMember || null });
});

// get all member coupons
// GET /api/member/coupons
router.get(
    "/member/coupons",
    currentMember,
    asyncHandler(async (req, res) => {
        const coupons = await Coupon.find({
            memberId: req.currentMember.id,
        });

        res.send(coupons);
    })
);

// Analytics
// GET /api/analytics
router.get(
    "/analytics",
    currentMember,
    asyncHandler(async (req, res) => {
        if (!req.currentMember.isBroker) {
            throw new BadRequestError("Only brokers can view analytics");
        }

        const coupons = await Coupon.find();

        const analyticsData = {};

        coupons.forEach(coupon => {
            const span = (coupon.redeemedAt - coupon.createdAt) / (24 * 60 * 60 * 1000); // Convert to Days
            const usage = coupon.redeemed ? 1 : 0;

            if (!analyticsData[coupon.title]) {
                analyticsData[coupon.title] = {
                    totalSpan: 0,
                    totalUsage: 0,
                    count: 0
                };
            }

            analyticsData[coupon.title].totalSpan += span;
            analyticsData[coupon.title].totalUsage += usage;
            analyticsData[coupon.title].count += 1;
        });

        res.send(analyticsData);
    })
);

module.exports = router;
