const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const app = express();

const port = process.env.PORT || 5000;

// const jwt = require('jsonwebtoken')

// const cookieParser = require('cookie-parser')

// const corsOptions = {
//     origin: ['http://localhost:5173'],
//     credentials: true,
//     optionalSuccessStatus: 200,
// }

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ak5c2.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

//middleware
app.use(express.json());
app.use(cors());
// app.use(cookieParser());

async function run() {
    try {
        // Connect the client to the server (optional starting in v4.7)
        //await client.connect();

        const database = client.db('BuildFolio');
        const BuildFolioCollection = database.collection('apartments');
        const apartmentRequestsCollection = database.collection('apartment-agreement');
        const announcementsCollection = database.collection('announcements');
        const couponsCollection = database.collection('coupons');
        const membersCollection = database.collection('members');
        const adminCollection = database.collection('admin');


        // JWT Authentication
        // app.post('/jwt', async (req, res) => {
        //     const user = req.body
        //     const token = jwt.sign(user, 'secret', {
        //         expiresIn: '365d',
        //     })
        //     res.send(token);
        // })

        // Apartments API
        app.get('/apartments', async (req, res) => {
            try {
                const cursor = BuildFolioCollection.find();
                const result = await cursor.toArray();
                res.status(200).send(result);
            } catch (err) {
                res.status(500).send({ error: 'Error fetching posts' });
            }
        });

        app.get('/apartments/:id', async (req, res) => {
            try {
                const id = req.params.id;
                const query = { _id: new ObjectId(id) };
                const apartment = await BuildFolioCollection.findOne(query);
                if (apartment) {
                    res.status(200).send(apartment);
                } else {
                    res.status(404).send({ error: "Apartment not found" });
                }
            } catch (error) {
                res.status(500).send({ error: "Failed to fetch apartment details" });
            }
        });

        app.delete('/apartments/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await BuildFolioCollection.deleteOne(query);
            res.send(result);
        });

        app.put('/apartments/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const options = { upsert: true };
            const updatedDoc = {
                $set: req.body
            }

            const result = await BuildFolioCollection.updateOne(filter, updatedDoc, options)

            res.send(result);
        })

        app.post('/apartments', async (req, res) => {
            const newApartment = req.body;
            const result = await BuildFolioCollection.insertOne(newApartment);
            res.send(result);
        });

        // Agreement Requests API
        app.get('/apartment-agreement', async (req, res) => {
            try {
                const cursor = apartmentRequestsCollection.find();
                const result = await cursor.toArray();
                res.status(200).send(result);
            } catch (err) {
                res.status(500).send({ error: 'Error fetching posts' });
            }
        });

        app.post('/apartment-agreement', async (req, res) => {
            try {
                const { userName, userEmail, floorNo, blockName, apartmentNo, rent } = req.body;

                // Ensure the user hasn't already applied for an apartment
                const existingRequest = await apartmentRequestsCollection.findOne({ userEmail });
                if (existingRequest) {
                    return res.status(400).send({ error: 'User has already applied for an apartment.' });
                }

                const newRequest = {
                    userName,
                    userEmail,
                    floorNo,
                    blockName,
                    apartmentNo,
                    rent,
                    status: 'pending',
                    requestDate: new Date()
                };

                const result = await apartmentRequestsCollection.insertOne(newRequest);
                res.status(201).send(result);
            } catch (error) {
                res.status(500).send({ error: 'Failed to create agreement request.' });
            }
        });

        app.put('/apartment-agreement/:id', async (req, res) => {
            const id = req.params.id;
            const { status } = req.body; // Only status is needed in the body to determine the action

            const filter = { _id: new ObjectId(id) };

            if (status === 'rejected') {
                // If the request is rejected, delete it from apartmentRequestsCollection
                const result = await apartmentRequestsCollection.deleteOne(filter);
                if (result.deletedCount > 0) {
                    return res.send({ success: true, message: 'Request rejected and deleted successfully!' });
                } else {
                    return res.status(404).send({ success: false, message: 'Request not found.' });
                }
            }

            if (status === 'accepted') {
                // If the request is accepted, add the user to membersCollection
                const agreement = await apartmentRequestsCollection.findOne(filter);
                if (agreement) {
                    // Insert into the members collection
                    await membersCollection.insertOne({
                        userName: agreement.userName,
                        userEmail: agreement.userEmail,
                        floorNo: agreement.floorNo,
                        blockName: agreement.blockName,
                        apartmentNo: agreement.apartmentNo,
                        rent: agreement.rent,
                        role: 'member',
                        agreementDate: new Date(),
                    });

                    // Update the status to 'accepted' in the apartmentRequestsCollection
                    const updateDoc = { $set: { status } };
                    const result = await apartmentRequestsCollection.updateOne(filter, updateDoc);
                    return res.send({ success: true, message: 'Request accepted and user added to members.' });
                } else {
                    return res.status(404).send({ success: false, message: 'Agreement not found.' });
                }
            }

            // If status is not 'rejected' or 'accepted', return an error
            return res.status(400).send({ success: false, message: 'Invalid status.' });
        });


        // Announcements API
        app.get('/announcements', async (req, res) => {
            try {
                const cursor = announcementsCollection.find();
                const result = await cursor.toArray();
                res.status(200).send(result);
            } catch (err) {
                res.status(500).send({ error: 'Error fetching posts' });
            }
        });

        app.post('/announcements', async (req, res) => {
            try {
                const newAnnouncement = req.body;
                const result = await announcementsCollection.insertOne(newAnnouncement);

                if (result.insertedId) {
                    res.status(201).send({ success: true, message: "Announcement created successfully!", data: result });
                } else {
                    res.status(400).send({ success: false, message: "Failed to create announcement." });
                }
            } catch (err) {
                res.status(500).send({ success: false, error: "Error creating announcement" });
            }
        });


        // Coupons API
        app.get('/coupons', async (req, res) => {
            const result = await couponsCollection.find().toArray();
            res.send(result);
        });

        app.get('/coupons/:code', async (req, res) => {
            try {
                const code = req.params.code;
                const query = { code: code };
                const coupon = await couponsCollection.findOne(query);
                if (coupon) {
                    res.status(200).send(coupon);
                } else {
                    res.status(404).send({ error: "coupon not found" });
                }
            } catch (error) {
                res.status(500).send({ error: "Failed to fetch coupon details" });
            }
        });

        app.post('/coupons', async (req, res) => {
            const newCoupon = req.body;
            const result = await couponsCollection.insertOne(newCoupon);
            res.send(result);
        });

        app.delete('/coupons/:id', async (req, res) => {
            const id = req.params.id;
            const result = await couponsCollection.deleteOne({ _id: new ObjectId(id) });
            res.send(result);
        });

        app.put('/coupons/:id', async (req, res) => {
            const id = req.params.id;
            const updatedCoupon = req.body;  // the updated coupon data (including availability)

            // Update the coupon in the database
            const result = await couponsCollection.updateOne(
                { _id: new ObjectId(id) },  // Find the coupon by ID
                { $set: updatedCoupon }      // Update the coupon with the new data
            );

            if (result.modifiedCount > 0) {
                res.send({ message: 'Coupon updated successfully' });
            } else {
                res.status(404).send({ message: 'Coupon not found or no changes made' });
            }
        });


        // Members API
        app.get('/members', async (req, res) => {
            try {
                const cursor = membersCollection.find();
                const result = await cursor.toArray();
                res.status(200).send(result);
            } catch (err) {
                res.status(500).send({ error: 'Error fetching posts' });
            }
        });

        app.get('/members/:id', async (req, res) => {
            try {
                const memberId = req.params.id;  // Extract the id from the URL
                const member = await membersCollection.findOne({ _id: new ObjectId(memberId) });  // Find by _id
                if (!member) {
                    return res.status(404).send({ error: 'Member not found' });
                }
                res.status(200).send(member);
            } catch (err) {
                res.status(500).send({ error: 'Error fetching member' });
            }
        });


        app.delete('/members/:id', async (req, res) => {
            const id = req.params.id;
            const result = await membersCollection.deleteOne({ _id: new ObjectId(id) });
            res.send(result);
        });

        // Admin API
        app.get('/admin', async (req, res) => {
            try {
                const cursor = adminCollection.find();
                const result = await cursor.toArray();
                res.status(200).send(result);
            } catch (err) {
                res.status(500).send({ error: 'Error fetching posts' });
            }
        });

        // await client.db("admin").command({ ping: 1 });
    } catch (error) {
        //console.log(error);
    }
}
run();


app.get('/', (req, res) => {
    res.send("Hello");
});

app.listen(port, () => {
    //console.log("Server running...");
});