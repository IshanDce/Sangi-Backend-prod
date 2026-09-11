import mongoose from 'mongoose';

export const connectDB = async (): Promise<void> => {
  const uri = process.env.MONGODB_URI!;
  await mongoose.connect(uri);
  console.log('? MongoDB connected');
};
