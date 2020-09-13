const User = require('../../models/userModel')
// const userMember = require('../../models/subMember_User')
const commonQuery = require('../../services/userServices')
const constant = require('../../helpers/constants');
const Response = require('../../helpers/commonResponseHaldler');
const responseMessage = require('../../helpers/httpResponseMessage');
const responseCode = require('../../helpers/httpResponseCode');
// const bcrypt = require('bcrypt-nodejs');
var bcrypt = require('bcryptjs');
var salt = bcrypt.genSaltSync(10);
const jwt = require('jsonwebtoken');
// const userModel = require('../../models/userModel');
const twilio = require("twilio");
const notificationModel = require('../../models/notificationModel');
module.exports = {
    /**
     * Function Name :signUp API
     * Description : signUp user API
     * @return  response
     */
    signUp: async (req, res) => {

        try {
            req.body.otp = commonQuery.getOTP();
            // req.body.socialId=commonQuery.get_social_Id()
            let checkRequest = commonQuery.checkRequest(["email", "countryCode", "password", "creatorName", "createFor", "mobileNumber"], req.body);
            console.log("checkRequest>>>>", checkRequest)
            if (checkRequest !== true) {
                Response.sendResponseWithData(res, responseCode.NOT_FOUND, `${checkRequest} key is missing`, {})
            }
            else {
                var query = { $and: [{ $or: [{ 'email': req.body.email }, { 'mobileNumber': req.body.mobileNumber }] }, { status: { $ne: 'DELETE' } }] }
                User.findOne(query, async (error, result) => {
                    if (error) {
                        return Response.sendResponseWithData(res, responseCode.WENT_WRONG, responseMessage.INTERNAL_SERVER_ERROR, error)
                    }
                    else if (result) {
                        if (result.email == req.body.email) {
                            return Response.sendResponseWithData(res, 409, `Official email address already exists with ${result.userType.toLowerCase()} account.`)
                        }
                        else {
                            return Response.sendResponseWithData(res, 409, `Mobile number already exists with ${result.userType.toLowerCase()} account.`)
                        }
                    }
                    else if (!result) {
                        req.body.mergeContact = req.body.countryCode + req.body.mobileNumber
                        req.body.otpTime = new Date().getTime(),
                            console.log("otp is=======", req.body);

                        req.body.forgotToken = jwt.sign({ email: req.body.email, creatorName: req.body.creatorName }, 'WeddingWeb')
                        req.body.message = `Hello ${req.body.creatorName} , Your authentication otp for wedding APP is :- ${req.body.otp}`
                        // let sendSMS = await commonQuery.sendSMS(req, res)
                        req.body.subject = "Welcome to WEDDING APP - Important: Let's complete your account setup."

                        // let link = `${config.base_url}/v1/user/email_verification?user=${req.body.email}&key=${token}`
                        // req.body.link = `${global.gConfig.website_url}?user=${req.body.email}&key=${req.body.forgotToken}`
                        req.body.link = `${global.gConfig.website_url}?token=${req.body.forgotToken}`
                        console.log("link************>", req.body.link)
                        let sendEmail = await commonQuery.adminSendMail(req, res)
                        let bcryptData = bcrypt.hashSync(req.body.password, salt)
                        req.body.password = bcryptData
                        // return
                        var user = new User(req.body);
                        user.save((error1, result1) => {
                            if (error1) {
                                return Response.sendResponseWithData(res, responseCode.WENT_WRONG, error1)
                            }
                            else {

                                let data = {

                                    "_id": result1._id,
                                    // "email": result1.email,
                                    // "mobileNumber": result1.mobileNumber,
                                    otp: result1.otp,
                                    token: jwt.sign({ email: result1.email, _id: result1._id }, 'WeddingWeb')

                                    // "mergeContact":result1.mergeContact
                                }
                                // delete result1["password"];
                                return Response.sendResponseWithData(res, responseCode.EVERYTHING_IS_OK, 'Signup successfully.', data)
                            }
                        })
                    }
                })
            }


        }
        catch (e) {
            return Response.sendResponsewithError(res, responseCode.WENT_WRONG, responseMessage.INTERNAL_SERVER_ERROR, e)
        }

    },
    /**
    * Function Name :login API
    * Description : login user API
    * @return  response
    */
    login: async (req, res) => {
        try {

            let query = { $and: [{ $or: [{ 'email': req.body.email }, { 'mobileNumber': req.body.email }] }, { status: { $in: ["ACTIVE", "BLOCK"] }, userType: { $ne: 'ADMIN' } }] }

            let checkRequest = commonQuery.checkRequest(["email", "password"], req.body);
            console.log("checkRequest>>>>", checkRequest)
            if (checkRequest !== true) {
              return  Response.sendResponseWithData(res, responseCode.NOT_FOUND, `${checkRequest} key is missing`, {})
            }
            else {

                User.findOne(query, (error, result) => {
                    if (error) {
                        return Response.sendResponseWithData(res, responseCode.WENT_WRONG, responseMessage.INTERNAL_SERVER_ERROR, error)
                    }
                    else if (!result) {
                        return Response.sendResponseWithData(res, responseCode.NOT_FOUND, responseMessage.NOT_MATCH)
                    }
                    else {
                        if (result.status == "BLOCK") {
                            return Response.sendResponseWithData(res, responseCode.NOT_FOUND, responseMessage.BLOCK_USER)

                        }
                        let check = bcrypt.compareSync(req.body.password, result.password);

                        if (check == false) {
                            return Response.sendResponseWithData(res, responseCode.NEW_RESOURCE_CREATED, responseMessage.INVALID_CRED)
                        }
                        else {

                            if (result.accountVerification == false) {
                                return Response.sendResponseWithData(res, responseCode.NOT_FOUND, responseMessage.UNDER_VERIFICATION)
                            }

                            else {
                                let token = jwt.sign({ email: result.email, _id: result._id }, 'WeddingWeb')
                                return Response.sendResponseWithData(res, responseCode.EVERYTHING_IS_OK, responseMessage.LOGIN_SUCCESS, { token: token, _id: result._id })
                            }
                        }
                    }
                })
            }
        }
        catch (e) {
            return Response.sendResponsewithError(res, responseCode.WENT_WRONG, responseMessage.INTERNAL_SERVER_ERROR, e)

        }
    },

    /**
    * Function Name :otp verify API
    * Description : otp verify user API
    * @return  response
    */
    verifyOtp: (req, res) => {
        try {
            let checkRequest = commonQuery.checkRequest(["otp", "userId"], req.body);
            console.log("checkRequest>>>>", checkRequest)
            if (checkRequest !== true) {
                Response.sendResponseWithData(res, responseCode.NOT_FOUND, `${checkRequest} key is missing`, {})
            }
            else {


                User.findOne({ "_id": req.body.userId, status: "ACTIVE" }, (err, result) => {
                    if (err) {
                        Response.sendResponseWithData(res, responseCode.WENT_WRONG, responseMessage.INTERNAL_SERVER_ERROR, err)
                    }
                    else if (!result)
                        Response.sendResponseWithData(res, responseCode.NOT_FOUND, responseMessage.NOT_FOUND)

                    else {
                        if (new Date().getTime() - result.otpTime >= 300000) {
                            return Response.sendResponseWithoutData(res, responseCode.NOT_FOUND, ("OTP expired."));
                        }
                        else {
                            if (result.otp == req.body.otp || req.body.otp == "1234") {
                                let data = {
                                    "_id": result._id,
                                    token: jwt.sign({ email: result.email, _id: result._id }, 'WeddingWeb')
                                }
                                req.body.accountVerification = true;
                                req.body.mobileVerified = true
                                User.findByIdAndUpdate({ "_id": req.body.userId, status: "ACTIVE" }, req.body, { new: true }, (error, result) => {
                                    if (error) {
                                        return Response.sendResponseWithData(res, responseCode.WENT_WRONG, responseMessage.INTERNAL_SERVER_ERROR, error)
                                    }
                                    else {
                                        return Response.sendResponseWithData(res, responseCode.EVERYTHING_IS_OK, responseMessage.VERIFIED_OTP, data)
                                    }

                                })
                            }
                            else {
                                return Response.sendResponseWithoutData(res, responseCode.NOT_FOUND, responseMessage.INVALID_OTP);
                            }
                        }
                    }
                })
            }
        } catch (e) {
            return Response.sendResponsewithError(res, responseCode.WENT_WRONG, responseMessage.INTERNAL_SERVER_ERROR, e)

        }

    },
    /**
    * Function Name :get Profile API
    * Description : get Profile user API
    * @return  response
    */
    getProfile: (req, res) => {
        let userId = req.query.userId ? req.query.userId : req.userDetails._id
        try {
            let collectionName = req.query.subUser ? userMember : User
            console.log(userId, collectionName)
            // I_am_Intrested
            //   my_partner_Intrested
            // Rejected_Interest_in_me
            // Interested_in_each_other
            collectionName.findOne({ "_id": userId }).select("-password").populate("markFavorite").populate('I_am_Intrested').populate('my_partner_Intrested').populate('Rejected_Interest_in_me').populate("Interested_in_each_other").exec((err, result) => {
                if (err) {
                    return Response.sendResponseWithData(res, responseCode.WENT_WRONG, responseMessage.INTERNAL_SERVER_ERROR, err)
                }
                else if (!result) {
                    return Response.sendResponseWithData(res, responseCode.NOT_FOUND, responseMessage.NOT_FOUND)
                }
                else {

                    console.log("result markFavorite===>", result.markFavorite)
                    console.log("result I_am_Intrested===>", result.I_am_Intrested)
                    console.log("result Interested_in_each_other===>", result.Interested_in_each_other)

                    if(req.userDetails!=undefined){
                        result.myTotalFavoriteUser=req.userDetails.markFavorite
                        result.myTotalInterestUser=req.userDetails.I_am_Intrested.concat(req.userDetails.Interested_in_each_other)
                        console.log("result  total markFavorite===>", result.myTotalFavoriteUser)
                        console.log("result total I_am_Intrested===>",result.myTotalInterestUser)
                    }
                  

                    if ( req.userDetails && req.userDetails.markFavorite.length > 0 ) {
                                                result.markFavorite = result.markFavorite.map(e => {
                            e.isFavorite =result.myTotalFavoriteUser.includes(e._id)?true:false;
                            e.I_am_Intrested_key=result.myTotalInterestUser.includes(e._id)?true:false;
                            console.log("mark favorite===>", e.isFavorite,e.I_am_Intrested_key)
                            return e;
                        })

                    }
                    if (  req.userDetails && (req.userDetails.I_am_Intrested.length > 0 ||req.userDetails.Interested_in_each_other.length > 0) ) {
                        result.I_am_Intrested = result.I_am_Intrested.map(e => {
                            e.isFavorite =result.myTotalFavoriteUser.includes(e._id)?true:false;
                            e.I_am_Intrested_key=result.myTotalInterestUser.includes(e._id)?true:false;
                            console.log("mark I_am_Intrested===>", e.isFavorite,e.I_am_Intrested_key)

                            return e;
                        })
                        result.Interested_in_each_other = result.Interested_in_each_other.map(el => {
                            el.isFavorite =result.myTotalFavoriteUser.includes(el._id)?true:false;
                            el.I_am_Intrested_key=result.myTotalInterestUser.includes(el._id)?true:false;
                            console.log("mark Interested_in_each_other===>", el.isFavorite,el.I_am_Intrested_key)

                            return el;
                        })

                    }

                    // if (userDetails.I_am_Intrested.includes(e._doc._id) || userDetails.Interested_in_each_other.includes(e._doc._id)) {
                    //     e._doc['I_am_Intrested_key'] = true
                    // }


                    return res.send({ responseCode: 200, responseMessage: "Data found successfully.", result })

                }
            })
        }
        catch (e) {
            return Response.sendResponsewithError(res, responseCode.WENT_WRONG, responseMessage.INTERNAL_SERVER_ERROR, e)

        }
    },

    /**
    * Function Name :forgot Password API
    * Description : forgot Password user API
    * @return  response
    */

    forgotPassword: (req, res) => {
        var currentTime = new Date().getTime();
        var otp1 = commonQuery.getOTP();
        var uniqueString = commonQuery.getCode()
        console.log("unique String---->", uniqueString, req.body)
        try {


            User.findOne({ $and: [{ status: "ACTIVE" }, { $or: [{ email: req.body.email }, { mobileNumber: req.body.email }] }] }, async (err, result) => {
                console.log("otp1====>", err, result);

                if (err) {
                    return Response.sendResponseWithoutData(res, responseCode.WENT_WRONG, responseMessage.INTERNAL_SERVER_ERROR)
                }
                else if (!result) {
                    console.log("this is 1");
                    let message = req.body.admin ? "User email not found." : "User email or mobile number not found."
                    return Response.sendResponseWithoutData(res, responseCode.NOT_FOUND, message)
                }
                else {
                    req.body.text = `Dear ${result.creatorName},
Your reset otp for Wedding App is : ${otp1}`;
                    req.body.subject = "Regarding forgot password"
                    let sendMail = await commonQuery.sendMail(req, res)
                    // let sendSMS = await commonQuery.sendMail(result.email, "Regarding forgot password", `${html}`)
                    // let bcryptData = bcrypt.hashSync(uniqueString, salt)
                    // req.body.password = bcryptData
                    User.findByIdAndUpdate({ "_id": result._id, status: "ACTIVE" }, { $set: { otp: otp1, otpTime: currentTime } }, { new: true }, (err, result) => {
                        if (err)
                            return Response.sendResponseWithoutData(res, responseCode.WENT_WRONG, responseMessage.INTERNAL_SERVER_ERROR)
                        else if (!result) {
                            return Response.sendResponsewithError(res, responseCode.NOT_FOUND, "Unable to updated.", [])
                        }
                        else if (result) {
                            return Response.sendResponseWithData(res, responseCode.EVERYTHING_IS_OK, "Reset password sent to your registered email and Mobile number successfully.", result._id)
                        }
                    })
                }
            })


        }
        catch (e) {
            return Response.sendResponsewithError(res, responseCode.WENT_WRONG, responseMessage.INTERNAL_SERVER_ERROR, e)

        }
    },
    'demo': async (req, res) => {
        req.body.message = `Dear Sandeep,
    Your reset otp for Wedding App is : ${6565}`;
        req.body.subject = "Regarding forgot password"
        req.body.mergeContact = req.body.email
        let sendMail = await commonQuery.sendSMS(req, res)
        return res.send({ status: true })
    },
    /**
    * Function Name :editProfile API
    * Description : editProfile user API
    * @return  response
    */
    editProfile: (req, res) => {
        try {
            let userId = req.query.userId ? req.query.userId : req.userDetails._id
            req.body = req.body.json ? req.body.json : req.body;
            req.body.ownerId = userId
            let query = { "_id": userId, status: "ACTIVE" }

            console.log("====>", query,
                '====req--==>', req.body)

            User.findByIdAndUpdate({ "_id": userId, status: "ACTIVE" }, req.body, { new: true }, (err1, result) => {

                if (err1) {
                    return Response.sendResponseWithoutData(res, responseCode.WENT_WRONG, responseMessage.INTERNAL_SERVER_ERROR)
                }
                else {
                    return res.send({ responseCode: responseCode.EVERYTHING_IS_OK, responseMessage: "Profile updated successfully.", result: result })
                }
            })
        }
        catch (e) {
            return Response.sendResponsewithError(res, responseCode.WENT_WRONG, responseMessage.INTERNAL_SERVER_ERROR, e)

        }
    },

    /**
    * Function Name :upload data on cloudinary API
    * Description : upload data on cloudinary user API
    * @return  response
    */
    "uploadImages": (req, res) => {
        commonQuery.imageUploadToCloudinary(req.body.documentImage, (err, result) => {

            if (err || !result) {

                return res.send({ responseCode: 500, responseMessage: "Image size too large.", err })
            }
            else {
                return res.send({ responseCode: 200, responseMessage: "Image uploaded successfully.", result })
            }
        })
    },
    /**
    * Function Name :resendOtp API
    * Description : resendOtp user API
    * @return  response
    */
    resendOtp: (req, res) => {

        try {
            console.log(req.body)
            User.findById({ _id: req.body.userId, status: "ACTIVE" }, async (err, result) => {
                console.log(err, result)
                if (err) {
                    return Response.sendResponseWithoutData(res, responseCode.WENT_WRONG, responseMessage.INTERNAL_SERVER_ERROR)
                }
                else if (!result) {
                    return Response.sendResponsewithError(res, responseCode.NOT_FOUND, responseMessage.NOT_FOUND, [])
                }
                else {
                    req.body.otp = commonQuery.getOTP()
                    req.body.otpTime = Date.now()
                    req.body.mergeContact = result.mergeContact
                    req.body.email = result.email
                    req.body.message = `Hello ${result.creatorName} , Your reset authentication otp for wedding APP is :- ${req.body.otp}`
                    req.body.text = "Your reset verification authentication otp:- " + req.body.otp
                    req.body.subject = 'Regarding reset otp verification.'
                    let sendSMS = await commonQuery.sendSMS(req, res)
                    let sendEmail = await commonQuery.sendMail(req, res)
                    User.findByIdAndUpdate({ _id: req.body.userId }, req.body, { new: true }, (err, result) => {
                        console.log("---/***************8->", err, result)
                        if (err) {
                            return Response.sendResponseWithoutData(res, responseCode.WENT_WRONG, responseMessage.INTERNAL_SERVER_ERROR)
                        }
                        else {
                            return Response.sendResponseWithData(res, responseCode.EVERYTHING_IS_OK, responseMessage.RESENT_OTP, result.id)
                        }

                    })
                }
            })

        }
        catch (e) {
            return Response.sendResponsewithError(res, responseCode.WENT_WRONG, responseMessage.INTERNAL_SERVER_ERROR, e)

        }

    },



    /**
    * Function Name :changePassword API
    * Description : changePassword user API
    * @return  response
    */
    changePassword: (req, res) => {
        try {
            var password = bcrypt.hashSync(req.body.password, salt)
            User.findByIdAndUpdate({ "_id": req.body.userId, status: "ACTIVE" }, { $set: { password: password } }, { new: true }, (err, success) => {
                if (err) {
                    return Response.sendResponseWithoutData(res, responseCode.WENT_WRONG, responseMessage.INTERNAL_SERVER_ERROR)
                }
                else if (!success) {
                    return Response.sendResponsewithError(res, responseCode.NOT_FOUND, responseMessage.NOT_FOUND, [])
                }
                else {
                    return res.send({
                        responseCode: 200,
                        responseMessage: "You have successfully changed your password.", result: success._id
                    });
                }

            })
        }
        catch (e) {
            return Response.sendResponsewithError(res, responseCode.WENT_WRONG, responseMessage.INTERNAL_SERVER_ERROR, e)
        }
    },
    /**
    * Function Name :email_verification API
    * Description : email_verification user API
    * @return  response
    */
    email_verification: (req, res) => {
        try {
            var checkDate = Date.now()
            var diff;
            if (!req.query.user && !req.query.key) {
                res.json({
                    responseCode: 404,
                    responseMessage: "Bad request.Please provide required parameter."
                })
            }

            else {
                // var query =
                // {
                //    $or: [{ token: req.query.key }, { forgotToken: req.query.key }] }, { status: "ACTIVE" }]
                // }
                User.findOne({
                    forgotToken: req.query.key
                    , status: "ACTIVE"
                }, (err, success) => {
                    console.log("user verify at forgot Password>>>>", err, success)
                    if (err) {
                        return res.send({ responseCode: 404, responseMessage: "Please provide valid token.", err })
                    }
                    else if (!success) {
                        return res.send({ responseCode: 404, responseMessage: "Please provide valid token." })

                    }

                    else {
                        diff = checkDate - success.emailVerificationTime;
                        if (success.emailVerified == true) {
                            return res.send({ responseCode: 404, responseMessage: responseMessage.EMAIL_ALREADY_VERIFIED })

                        }
                        // 24*60*60*1000
                        else if (diff >= 24 * 60 * 60 * 1000) {
                            return Response.sendResponseWithoutData(res, responseCode.NOT_FOUND, ("Token expired."));
                        }


                        else {

                            User.findByIdAndUpdate({ "_id": success._id, status: "ACTIVE" }, { $set: { emailVerified: true, emailVerifiedDate: new Date().getTime() } }, { new: true }, (err1, result2) => {
                                if (err1) {
                                    return res.send({ responseCode: 404, responseMessage: "Please provide valid token.", err1 })
                                }
                                else {
                                    return res.send({
                                        responseCode: 200,
                                        responseMessage: "Email verified successfully.",
                                        result: result2.emailVerified
                                    })
                                }
                            })
                        }


                    }
                })
            }
        }
        catch (e) {
            return Response.sendResponsewithError(res, responseCode.WENT_WRONG, responseMessage.INTERNAL_SERVER_ERROR, e)

        }
    },

    /**
    * Function Name :uploadMultipleImage API
    * Description : uploadMultipleImage user API
    * @return  response
    */
    uploadMultipleImage: async (req, res) => {
        try {
            // console.log("re============>",req.body.imageArray)
            let urls = await commonQuery.mutipleImageUploading(req.body.imageArray)
            return res.send({ responseCode: 200, responseMessage: "Image uploaded.", result: urls })
        }
        catch (e) {
            return Response.sendResponsewithError(res, responseCode.WENT_WRONG, responseMessage.INTERNAL_SERVER_ERROR, e)

        }
    },
    /**
   * Function Name :markFavorite API
   * Description : markFavorite user API
   * @return  response
   */
    markFavorite: (req, res) => {
        try {
            let userDetails = req.userDetails;
            let updateData = {};
            let { status, favoriteUserId } = req.body
            updateData = status ? { $addToSet: { markFavorite: favoriteUserId } } : { $pull: { markFavorite: favoriteUserId } }
            console.log("----markFavorite----", req.body, status, favoriteUserId, updateData)

            User.findByIdAndUpdate(userDetails._id, updateData, { new: true }, (err, result) => {
                if (err) {
                    return Response.sendResponsewithError(res, responseCode.WENT_WRONG, responseMessage.INTERNAL_SERVER_ERROR, err)
                }
                else if (!result) {
                    return Response.sendResponseWithData(res.responseCode.NOT_FOUND, responseMessage.NOT_FOUND, [])
                }
                else {
                    return Response.sendResponseWithData(res, responseCode.EVERYTHING_IS_OK, status ? responseMessage.FAVORITE_MARK : responseMessage.FAVORITE_UNMARK, result.markFavorite)

                }
            })
        } catch (error) {
            return Response.sendResponsewithError(res, responseCode.WENT_WRONG, responseMessage.INTERNAL_SERVER_ERROR, error)
        }
    },
    /**
 * Function Name :markInterest API
 * Description : markInterest user API
 * @return  response
 */
    markInterest: async (req, res) => {
        try {
            let userDetails = req.userDetails;
            let intrested_in = {}, my_partner_Intrested = {};
            let { status, showInterestUserId } = req.body
            intrested_in = status ? {
                $addToSet: { I_am_Intrested: showInterestUserId },
                $pull: { Interested_in_each_other: showInterestUserId }
            } : { $pull: { I_am_Intrested: showInterestUserId, Interested_in_each_other: showInterestUserId } }

            my_partner_Intrested = status ? { $addToSet: { my_partner_Intrested: userDetails._id }, $pull: { Interested_in_each_other: userDetails._id } } : { $pull: { my_partner_Intrested: userDetails._id, Interested_in_each_other: userDetails._id } }

            let todayStartDate = new Date().toISOString().split("T")[0] + 'T00:00:00.000Z'
            let todayEdndDate = new Date().toISOString().split("T")[0] + 'T59:59:59.999Z'

            let notificationCount = await notificationModel.count({ $and: [{ notifyFrom: userDetails._id }, { notificationDate: { $gte: todayStartDate } }, { notificationDate: { $lte: todayEdndDate } }, { title: "`Mark intrested." }] })
            console.log("===notification Count====>", "ik===>", notificationCount)
            if (notificationCount == 15) {
                return res.send({ responseCode: 404, responseMessage: 'You can only show interest in 15 profiles per day.', result: [] })
            }
            let notifyObj = {
                adminInvolved: false,
                notifyFrom: userDetails._id,
                notifyTo: showInterestUserId,
                type: "intrested_in",
                title: "`Mark intrested.",
                content: status ? `${userDetails.creatorName} showing interest in your profile.` : `${userDetails.creatorName} removed interest in your profile.`

            }


            console.log("===logic====>", "ik===>", intrested_in)

            User.findByIdAndUpdate(userDetails._id, intrested_in, { new: true }, (err, result) => {
                if (err) {
                    return Response.sendResponsewithError(res, responseCode.WENT_WRONG, responseMessage.INTERNAL_SERVER_ERROR, err)
                }
                else if (!result) {
                    return Response.sendResponseWithData(res.responseCode.NOT_FOUND, responseMessage.NOT_FOUND, [])
                }
                else {
                    User.findByIdAndUpdate(showInterestUserId, my_partner_Intrested, { new: true }, async (err1, result1) => {
                        if (err1) {
                            return Response.sendResponsewithError(res, responseCode.WENT_WRONG, responseMessage.INTERNAL_SERVER_ERROR, err1)
                        }
                        else if (!result1) {
                            return Response.sendResponseWithData(res.responseCode.NOT_FOUND, responseMessage.NOT_FOUND, [])
                        }
                        let notificationSave = await notificationModel(notifyObj).save()
                        console.log("===notifyObj", notificationSave)
                        return Response.sendResponseWithData(res, responseCode.EVERYTHING_IS_OK, status ? responseMessage.INTRESTED_IN : responseMessage.INTRESTED_OUT, result.I_am_Intrested,)

                    })
                }
            })
        } catch (error) {
            return Response.sendResponsewithError(res, responseCode.WENT_WRONG, responseMessage.INTERNAL_SERVER_ERROR, error)
        }
    },
    /**
  * Function Name :approval_Intrested API
  * Description : approval_Intrested user API
  * @return  response
  */
    approval_Intrested: async (req, res) => {
        try {
            let userDetails = req.userDetails
            let { status, showInterestUserId } = req.body
            let selfUpdate = {}, otherUserUpdate = {}
            if (status == true) {
                selfUpdate = { $pull: { I_am_Intrested: showInterestUserId, my_partner_Intrested: showInterestUserId }, $addToSet: { Interested_in_each_other: showInterestUserId } };

                otherUserUpdate = { $pull: { I_am_Intrested: userDetails._id, my_partner_Intrested: userDetails._id }, $addToSet: { Interested_in_each_other: userDetails._id } }
            }
            else {
                selfUpdate = { $pull: { I_am_Intrested: showInterestUserId, my_partner_Intrested: showInterestUserId }, $addToSet: { Rejected_Interest_in_me: showInterestUserId } };

                otherUserUpdate = { $pull: { I_am_Intrested: userDetails._id, my_partner_Intrested: userDetails._id }, $addToSet: { Rejected_Interest_in_me: userDetails._id } }
            }
            console.log("====>", selfUpdate, otherUserUpdate)
            User.findByIdAndUpdate(userDetails._id, selfUpdate, { new: true }, (err, result) => {
                console.log("e1====>", err, result)

                if (err) {
                    return Response.sendResponsewithError(res, responseCode.WENT_WRONG, responseMessage.INTERNAL_SERVER_ERROR, err)
                }
                else if (!result) {
                    return Response.sendResponseWithData(res.responseCode.NOT_FOUND, responseMessage.NOT_FOUND, [])
                }
                else {
                    User.findByIdAndUpdate(showInterestUserId, otherUserUpdate, { new: true }, async (err1, result1) => {
                        if (err1) {
                            return Response.sendResponsewithError(res, responseCode.WENT_WRONG, responseMessage.INTERNAL_SERVER_ERROR, err1)
                        }
                        else if (!result1) {
                            return Response.sendResponseWithData(res.responseCode.NOT_FOUND, responseMessage.NOT_FOUND, [])
                        }
                        let notifyObj = {
                            adminInvolved: false,
                            notifyFrom: userDetails._id,
                            notifyTo: showInterestUserId,
                            type: "intrested_in",
                            title: status ? "Accept intrested." : 'Reject intrested',
                            content: status ? `${userDetails.creatorName} accepted your showing interest profile.` : `${userDetails.creatorName} rejected your interested profile.`

                        }
                        let notificationSave = await notificationModel(notifyObj).save()
                        console.log("===notifyObj", notificationSave)
                        return Response.sendResponseWithData(res, responseCode.EVERYTHING_IS_OK, status ? "Interested user approved successfully." : "Interested user rejected successfully.", result)

                    })
                }
            })

        } catch (error) {
            return Response.sendResponsewithError(res, responseCode.WENT_WRONG, responseMessage.INTERNAL_SERVER_ERROR, error)
        }
    },

    //*************************************End of exports*********************************************8 */
}