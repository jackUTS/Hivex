const jwt = require("jsonwebtoken")
const Member = require("../models/memberModel")

const currentMember = async (req, res, next) => {
    if (!req.session?.jwt) {
        return next();
    }

    try {
        const payload = jwt.verify(req.session.jwt, process.env.JWT_KEY);
        const member = await Member.findById(payload.id);
        req.currentMember = member;
    } catch (err) {}

    next();
};

module.exports = { currentMember };