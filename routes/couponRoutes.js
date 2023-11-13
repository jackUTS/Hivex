const { BadRequestError, NotFoundError } = require("@dqticket/common");
const express = require("express");
const mongoose = require('mongoose');
const Grid = require("gridfs-stream");
const { Readable } = require("stream");



const asyncHandler = require("../middleware/asyncHandler");
const { currentVenue } = require("../middleware/current-venue");
const { currentMember } = require("../middleware/current-member");
const Coupon = require("../models/couponModel");
const Deal = require("../models/dealModel")
const voucher = require("voucher-code-generator")
const qr = require("qrcode");


const db = mongoose.connection;

const router = express.Router();
Grid.mongo = mongoose.mongo;
const gfs = Grid(db);

const generateAndStoreQRCode = async (couponCode) => {
    return new Promise((resolve, reject) => {
        qr.toDataURL(couponCode, async (err, url) => {
            if (err) {
                reject(err);
            }

            const qrCodeImageData = url.split(';base64,').pop();
            const qrCodeImageBuffer = Buffer.from(qrCodeImageData, "base64");
            
            const bucket = new mongoose.mongo.GridFSBucket(db.db, {
                bucketName: "qr-code-images",
            });

            const uploadStream = bucket.openUploadStream("qr-code.png");

            uploadStream.write(qrCodeImageBuffer);
            uploadStream.end();

            uploadStream.on("finish", () => {
                resolve(uploadStream);
            });

            uploadStream.on("error", (error) => {
                reject(error);
            });
        })
    })
}

// Create coupon
// POST /api/coupons
router.post(
    "/",
    currentVenue,
    currentMember,
    asyncHandler(async (req, res) => {
        const { title, code, value, expiry } = req.body;

        const currentDeal = await Deal.findOne({_id: req.body.id})
        const createdCoupons = [];

        for (i = 0; i < currentDeal.totalCreated; i++) {

            const couponCode = voucher.generate({
                length: 4,
                charset: 'alphanumeric',
            })[0];

            const qrCodeImageUrl = await generateAndStoreQRCode(couponCode);

            const coupon = await Coupon.create({
                title: currentDeal.title,
                code: couponCode,
                value: currentDeal.value,
                expiry: currentDeal.expiry,
                venueId: req.currentVenue.id,
                dealId: currentDeal.id,
                qrCodeImageUrl: qrCodeImageUrl,
            });

            createdCoupons.push(coupon);
            await coupon.save();
        }
            res.status(201).send(createdCoupons);
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
            throw new NotFoundError("Coupon not found")
        }
        if (coupon.expiry < new Date()/1000){
            throw new BadRequestError("Coupon Expired")
        }
        else {
            res.send(coupon)
        }
    })
);

// Redeem coupon
// POST /api/coupons/redeem
router.post('/redeem', 
    currentMember,
    asyncHandler(async (req, res) => {

        const {code} = req.body;
        const memberId = "65050ae449718be08cde1cc4";

        const coupon = await Coupon.findOne({code})
        console.log("Coupon is: ", coupon);
        console.log("Code is: ", code);

        if (!coupon) {
            throw new NotFoundError("Coupon not found")
        }
        if (coupon.memberId !== memberId) {
            throw new BadRequestError("Member not authenticated");
        }
        if (coupon.expiry < new Date()/1000){
            throw new BadRequestError("Coupon Expired")
        }
        if (coupon.redeemed === true){
            throw new BadRequestError("Coupon Already Redeemed")
        }
        if (coupon.memberId === memberId && coupon.redeemed === false){
            coupon.redeemed = true;
            coupon.redeemedAt = new Date();
            await coupon.save()
            res.status(201).send(coupon);
            res.json({ success: true, message: 'Coupon redeemed successfully' });
        } 
    })
);

//Claim a Coupon
//GET /api/coupons/assign
router.post ("/assign", async (req, res) => {

    const coupons = await Coupon.find();
    const memberId = "65050ae449718be08cde1cc4";
    const couponsForMember = coupons.filter((coupon) => coupon.memberId === memberId);
    currentDeal = {id: "65390b676d471d276a63d068"};
    console.log('Current Member ID: ', memberId);

    try {
        console.log("Current Deal ID: ", currentDeal.id);
        const noMemberCoupon = await Coupon.findOne({
            memberId: {$exists: false},
            'dealId': currentDeal.id,
        });

        if (noMemberCoupon) {
            console.log("Next Coupon without memberId: ", noMemberCoupon);
            if (couponsForMember >= 6){
                console.log(couponsForMember.length);
                throw new BadRequestError("No more than 6 coupons per member allowed"); 
            }
            else {
                noMemberCoupon.memberId = memberId;
                console.log(noMemberCoupon.memberId);
                res.send(noMemberCoupon);
                await noMemberCoupon.save();
            }
            
        } else {
            console.log("No Coupons without memberId found.");
            res.status(400).json({ message: 'All Coupons Claimed!'})
        }

    } catch (error) {
        console.error('Error finding Coupon wihtout memberId: ', error);
        res.status(500).json({ message: 'Internal server error'})
    }
});

module.exports = router;
