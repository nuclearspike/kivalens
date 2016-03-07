"use strict"
const vision = require('node-cloud-vision-api')
const redis = require('redis')
const rc = redis.createClient(process.env.REDISCLOUD_URL)

if (process.env.VISION_API_KEY)
    vision.init({auth: process.env.VISION_API_KEY})
else
    console.log("NO VISION API KEY. GOOGLE CLOUD VISION CALLS WILL FAIL.")


//var loan = {id: 1030057, image: {id: 2110898}}


/**
 * "joyLikelihood":"VERY_LIKELY","sorrowLikelihood":"VERY_UNLIKELY","angerLikelihood":"VERY_UNLIKELY",
 * "surpriseLikelihood":"VERY_UNLIKELY","underExposedLikelihood":"VERY_UNLIKELY","blurredLikelihood":"VERY_UNLIKELY",
 * "headwearLikelihood":"VERY_UNLIKELY"
 */

const processFaces = annotations => {
    return annotations.map(a=>{
        return {joyLikelihood: a.joyLikelihood,
            sorrowLikelihood: a.sorrowLikelihood,
            angerLikelihood: a.angerLikelihood,
            surpriseLikelihood: a.surpriseLikelihood,
            headwearLikelihood: a.headwearLikelihood}
    })
}

function guaranteeGoogleVisionForLoan(loan, doneCallback) {
    if (typeof doneCallback !== 'function') doneCallback = () => true

    var facesKey = `vision_faces_${loan.id}`,
        vlkey = `vision_label_${loan.id}`,
        doFaceDetection = false,
        doVisionLabels = false

    if (loan.kl_faces && loan.kl_visionLabels) {
        doneCallback()
        return
    }

    rc.mget([facesKey,vlkey],(err,result)=>{
        var features = []
        //console.log("get array", err, result)
        if (err){
            doneCallback(404)
            return
        }
        if (!loan.kl_faces && !result[0]){
            features.push(new vision.Feature('FACE_DETECTION', 4))
            doFaceDetection = true
        }

        if (!loan.kl_visionLabels && !result[1]) {
            features.push(new vision.Feature('LABEL_DETECTION', 10))
            doVisionLabels = true
        }

        if (!features.length){ //we have everything we need.
            loan.kl_faces        = loan.kl_faces || JSON.parse(result[0])
            loan.kl_visionLabels = loan.kl_visionLabels || JSON.parse(result[1])
            doneCallback()
            return
        }

        //we have stuff to do.
        const req = new vision.Request({
            image: new vision.Image({url: `https://www.kiva.org/img/orig/${loan.image.id}.jpg`}),
            features: features
        })

        console.log(`Making ${features.length} Vision API requests: ${loan.id}`)
        vision.annotate([req]).then(res => {
            if (doFaceDetection) {
                if (res.responses[0].faceAnnotations) { //wouldn't have it if didn't need it.
                    loan.kl_faces = processFaces(res.responses[0].faceAnnotations)
                } else {
                    loan.kl_faces = []
                }
                rc.set(facesKey, JSON.stringify(loan.kl_faces))
                rc.expire(facesKey, '2592000') //30 days
            }
            if (doVisionLabels) {
                if (res.responses[0].labelAnnotations) {
                    loan.kl_visionLabels = res.responses[0].labelAnnotations
                } else {
                    loan.kl_visionLabels = []
                }
                rc.set(vlkey, JSON.stringify(loan.kl_visionLabels))
                rc.expire(vlkey, '2592000') //30 days
            }
            doneCallback()
            console.log(JSON.stringify(loan.kl_faces))
        }, e => {
            doneCallback(404)
            console.log('Error: ', e)
        })
    })
}

//guaranteeGoogleVisionForLoan(loan)

module.exports = guaranteeGoogleVisionForLoan