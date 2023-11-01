const { BadRequestError, NotFoundError } = require("@dqticket/common");
const express = require("express");

const asyncHandler = require("../middleware/asyncHandler");
const { currentVenue } = require("../middleware/current-venue");
const Coupon = require("../models/couponModel");
const Deal = require("../models/dealModel");
const voucher = require("voucher-code-generator");
const { currentMember } = require("../middleware/current-member");

const router = express.Router();

// Create coupon
// POST /api/coupons
router.post(
    "/",
    currentVenue,
    currentMember,
    asyncHandler(async (req, res) => {
        const { title, code, value, expiry } = req.body;

        const existingCoupon = await Coupon.findOne({
            memberId: req.currentMember.id,
            dealId,
        });

        if (existingCoupon) {
            return res.status(400).json({ error: 'Member already has a coupon for this deal'});
        }

        const deal = await Deal.findById(dealId);

        if (!deal) {
            return res.status(400).json({ error: 'Selected deal does not exist'});
        }

        for (i = 0; i < deal.totalCreated; i++) {
        const couponCode = voucher.generate({
            length: 4,
            charset: 'alphanumeric',
        })[0]

        const coupon = await Coupon.create({
            title: deal.title,
            code: couponCode,
            value: deal.value,
            expiry: deal.expiry,
            venueId: req.currentVenue.id,
            memberId: req.currentMember.id,
            dealId: "65390b676d471d276a63d068",
        });
        await coupon.save();
    }

        res.status(201).send(coupon);
    })
);

// get all coupons
// GET /api/coupons
router.get(
    "/",
    currentVenue,
    asyncHandler(async (req, res) => {
        const coupons = await Coupon.find({
            venueId: req.currentVenue.id,
        });

        res.send(coupons);
    })
);

//get single coupon
//GET /api/coupons/:code
router.get(
    "/:code",
    currentVenue,
    asyncHandler(async (req, res) => {
        const code = req.params.code
        const coupon = await Coupon.findOne({code})

        if (!coupon) {
            throw new NotFoundError()
        }
        if (coupon.expiry < new Date()/1000){
            throw new BadRequestError("Coupon Expired")
        }
        else {
            res.send(coupon)
        }
    })
)

module.exports = router;
