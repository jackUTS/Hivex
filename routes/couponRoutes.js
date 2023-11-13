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
            throw new NotFoundError()
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
// POST /api/coupons/redeem-coupon
router.post('/redeem-coupon/:code', 
    currentMember,
    asyncHandler(async (req, res) => {

        const code = req.params.code
        const coupon = await Coupon.findOne({code})
        const memberId = req.currentMember.id;
        const coupons = await Coupon.find();
        const couponsForMember = coupons.filter(coupon => coupon.memberId === memberId);

        if (coupon.memberId !== req.currentMember.id) {
            throw new BadRequestError("Member not authenticated");
        }
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
            coupon.redeemedAt = new Date();
            await coupon.save()
            res.status(201).send(coupon);
            res.json({ success: true, message: 'Coupon redeemed successfully' });
        } 
        if (couponsForMember.length >= 6){
            console.log(couponsForMember.length);
            throw new BadRequestError("No more than 6 coupons per member allowed"); 
        }
        else {
            res.send(coupon);
        }
    })
);

//Claim a Coupon
//GET /api/coupons/assign
router.get ("/coupons/assign", async (req, res) => {

    const coupons = await Coupon.find();
    const couponsForMember = coupons.filter(coupon => coupon.memberId === memberId);

    try {
        const noMemberCoupon = await Coupon.findOne({
            memberId: {$exists: false},
            'dealId': currentDeal.id,
        });

        if (noMemberCoupon) {
            console.log("Next Coupon without memberId: ", noMemberCoupon);
            if (couponsForMember.length >= 6){
                console.log(couponsForMember.length);
                throw new BadRequestError("No more than 6 coupons per member allowed"); 
            }
            else {
                noMemberCoupon.memberId = currentMember.id;
                res.send(noMemberCoupon);
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
