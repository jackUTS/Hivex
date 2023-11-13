const mongoose = require("mongoose");

const couponSchema = mongoose.Schema(
    {
        title: {
          type: String,
        },
        code: {
          type: String,
          unique: true,
        },
        value: {
          type: String,
        },
        expiry: {
          type: Date,
          required: true,
          default: Date.now() + 7*24*60*60*1000, // 1 week
        },
        memberId: {
          type: String,
          default: null
        },
        venueId: {
          type: String,
          required: true
        },
        points: {
          type: Number,
          default: 10
        },
        redeemed: {
          type: Boolean,
          default: false
        },
        redeemedAt: {
          type: Date,
          default: null
        }
    },
    {
        timestamps: true,
        toJSON: {
            transform(doc, ret) {
                ret.id = ret._id;
                delete ret._id;
            },
        },
    }
);

const Coupon = mongoose.model("Coupon", couponSchema);

module.exports = Coupon;
