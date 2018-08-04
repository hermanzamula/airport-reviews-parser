process.env.NODE_ENV = 'test';

//Require the dev-dependencies
const chai = require('chai');
const chaiHttp = require('chai-http');
const server = require('../app');
const fs = require("fs");
chai.should();

chai.use(chaiHttp);
chai.use(require('chai-things'));

describe('Airport Reviews Parser', () => {
    
    beforeEach(function (done) {
        chai.request(server)
            .post('/api/upload')
            .attach('file', fs.readFileSync('test/airport.csv'), 'airport.csv')
            .end(() => {
                done();
            });
    });

    describe('/api/upload csv file', function () {
        this.timeout(30000);

        it('it should upload csv file by url', (done) => {
            chai.request(server)
                .post('/api/upload')
                .send({url: "https://bitbucket.org/simongausmann/dreamlines-some-csv-file/raw/a64f652a881a0de1e4dbe569df604f47a3ac1e52/airport.csv"})
                .end((err, res) => {
                    res.should.have.status(200);
                    done();
                });
        });
    });

    describe('/api/all/stats', () => {
        it('it should GET all stats for the all airports', (done) => {
            chai.request(server)
                .get('/api/all/stats')
                .end((err, res) => {
                    res.should.have.status(200);
                    res.body.should.be.an('array')
                        .with.length.above(500)
                        .that.all.have.property('reviewCount')
                        .that.all.have.property('airportName');
                    done();
                });
        });
    });

    describe('/api/:airportName/stats', () => {
        it('it should GET all stats for the airport', (done) => {
            chai.request(server)
                .get('/api/london-heathrow-airport/stats')
                .end((err, res) => {
                    res.should.have.status(200);
                    res.body.should.to.deep.equal({
                            airportName: 'london-heathrow-airport',
                            reviewCount: 520,
                            recommendationCount: 160,
                            averageOverallRating: 4.85314685314685
                        });
                    done();
                });
        });
    });

    describe('/api/:airportName/reviews', () => {
        it('it should GET all reviews for the airport', (done) => {
            chai.request(server)
                .get('/api/london-heathrow-airport/reviews')
                .end((err, res) => {
                    res.should.have.status(200);
                    res.body.should.be.an('array')
                        .with.length.above(500)
                        .that.all.have.property('content');
                    done();
                });
        });
    });
});