const express = require('express');
const request = require('request');
const csv = require('csvtojson');
const multiparty = require('multiparty');
const fs = require('fs');
const hash = require('object-hash');

const reviewsStorage = {};
const existedReviewsHashes = new Set();

const router = express.Router();

/**
 * @swagger
 * /api/all/stats:
 *   get:
 *     description: Returns a list of review statistics per airport. Each item consists of the fields airportName and reviewCount. The collection is ordered by reviewCount in descending order.
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: a list of the stats
 */
router.get('/all/stats', function (req, res) {
    const reviewsStats = Object.keys(reviewsStorage).map(airportName => {
        return {
            airportName, reviewCount: reviewsStorage[airportName].length
        }
    });
    res.status(200).send(reviewsStats.sort((a, b) => b.reviewCount - a.reviewCount));
});

/**
 * @swagger
 * /api/{airportName}/stats:
 *   get:
 *     description: Returns detailed stats for a given airport
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: airportName
 *         description: Airport name.
 *         in: path
 *         required: true
 *         type: string
 *     responses:
 *       200:
 *         description: an object that contains the statistics for the airport
 *
 */
router.get('/:airportName/stats', function (req, res) {
    let reviews = reviewsStorage[req.params.airportName];
    if (!reviews) {
        return res.status(404).send(`Reviews for the airport ${req.params.airportName} doesn't exists`);
    }

    const stats = {
        airportName: req.params.airportName,
        reviewCount: reviews.length,
        recommendationCount: 0,
        averageOverallRating: 0
    };
    let ratedReviewsIdx = 0;
    reviews.forEach((c) => {
        stats.recommendationCount = c.recommended ? stats.recommendationCount + 1 : stats.recommendationCount;
        if (c.overall_rating) {
            stats.averageOverallRating = (ratedReviewsIdx * stats.averageOverallRating + c.overall_rating) / (++ratedReviewsIdx);
        }
    });

    res.send(stats);
});

/**
 * @swagger
 * /api/{airportName}/reviews:
 *   get:
 *     description: Returns a list of reviews for the given airport, ordered by date. The latest review is returned as the first element.
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: airportName
 *         description: Airport name.
 *         in: path
 *         required: true
 *         type: string
 *     responses:
 *       200:
 *         description: an array of the review objects
 *
 */
router.get('/:airportName/reviews', function (req, res) {
    let reviews = reviewsStorage[req.params.airportName];
    if (!reviews) {
        return res.status(404).send(`Reviews for the airport ${req.params.airportName} doesn't exist`);
    }
    if (req.query.ratingThreshold) {
        reviews = reviews.filter(r => r.overall_rating >= req.query.ratingThreshold);
    }
    res.send(reviews.sort((a, b) => b.date - a.date));
});

/**
 * @swagger
 * /api/upload:
 *   post:
 *     description: Uploads a csv file by link or using multipart/form-data
 *     parameters:
 *       - name: file
 *         in: formData
 *         description: CSV to upload
 *         required: false
 *         type: file
 *       - name: url
 *         in: json
 *         description: Set url to upload from
 *         required: false
 *         type: object
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           encoding:
 *             file:
 *               contentType: text/csv
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               url:
 *                 type: string
 *     responses:
 *       200:
 *         description: Successful upload message
 *
 */
router.post('/upload', function (req, res) {
    const url = req.body.url;
    if (url) {
        return handleCsvAsStream(request.get(url), res);
    }
    const form = new multiparty.Form();
    form.parse(req, (err) => {
        if (err) {
            res.status(400).send(err);
        }
    });
    form.on("file", function (name, file) {
        console.log(`Handle file ${file.path}`);
        handleCsvAsStream(fs.createReadStream(file.path), res);
    });
});

function handleJsonReview(json) {
    const airportName = json.airport_name;

    if (!airportName) {
        return;
    }

    const hashedReview = hash(json);

    if (existedReviewsHashes.has(hashedReview)) {
        return;
    }

    if (!reviewsStorage[airportName]) {
        reviewsStorage[airportName] = [];
    }

    json.date = new Date(json.date);

    reviewsStorage[airportName].push(json);
    existedReviewsHashes.add(hashedReview);
}

function handleCsvAsStream(stream, res) {
    csv({
        ignoreEmpty: true,
        checkType: true
    }).fromStream(stream)
        .on("header", (headerValues) => {
            //TODO: validate headers
            return headerValues
        })
        .subscribe((json) => {
            handleJsonReview(json);
        }, (err) => res.status(500).send("Error has been occurred: " + err), () => {
            console.log("Updated");
            res.status(200).send("CSV has been parsed successfully");
        });
}

module.exports = router;
