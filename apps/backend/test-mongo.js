import { MongoClient } from 'mongodb';
const uri = 'mongodb+srv://rafysoleman_db_user:WIS3R3a3L2EMAMLM@cluster0.wge69r9.mongodb.net/';

MongoClient.connect(uri)
  .then(client => {
    console.log('✓ MongoDB connection successful!');
    client.close();
  })
  .catch(err => {
    console.error('✗ MongoDB connection failed:', err.message);
  });
