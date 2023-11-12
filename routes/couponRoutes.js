const { BadRequestError, NotFoundError } = require("@dqticket/common");
const express = require("express");

const asyncHandler = require("../middleware/asyncHandler");
const { currentVenue } = require("../middleware/current-venue");
const { currentMember } = require("../middleware/current-member");
const Coupon = require("../models/couponModel");
const Deal = require("../models/dealModel")
const voucher = require("voucher-code-generator")

const router = express.Router();

// Create coupon
// POST /api/coupons
router.post(
    "/",
    currentVenue,
    asyncHandler(async (req, res) => {
        const { title, code, value, expiry } = req.body;
        const couponCode = voucher.generate({
            length: 4,
            charset: 'alphanumeric',
            count: Deal.totalCreated,
        })

        const coupon = await Coupon.create({
            title,
            code,
            value,
            expiry,
            venueId: req.currentVenue.id,
        });
        await coupon.save();

        res.status(201).send(coupon);
    })
);

// get all venue coupons
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

// Redeem coupon
// POST /api/coupons/redeem-coupon
router.post('/redeem-coupon/:code', 
    currentMember,
    asyncHandler(async (req, res) => {

        if (!req.currentMember) {
            throw new BadRequestError("Member not authenticated");
        }
          
        const code = req.params.code
        const coupon = await Coupon.findOne({code})
        const memberId = req.currentMember.id;
        const coupons = await Coupon.find();
        const couponsForMember = coupons.filter(coupon => coupon.memberId === memberId);

        if (!coupon) {
            throw new NotFoundError()
        }
        if (coupon.expiry < new Date()/1000){
            throw new BadRequestError("Coupon Expired")
        }
        if (coupon.redeemed === true){
            throw new BadRequestError("Coupon Already Redeemed")
        }
        if (coupon.memberId === req.currentMember.id && coupon.redeemed === false){
            coupon.redeemed = true;
            await coupon.save()
            res.status(201).send(coupon);
            res.json({ success: true, message: 'Coupon redeemed successfully' });
        } 
        if (couponsForMember.length >= 6){
        throw new BadRequestError("No more than 6 coupons per member allowed"); 
        }
        else {
            res.status(201).send(coupon);
        }
    })
);

module.exports = router;
