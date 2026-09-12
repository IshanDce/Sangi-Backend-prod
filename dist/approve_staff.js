"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const MONGODB_URI = "mongodb+srv://sangihomeservices_db_user:0kSCDmDJFsT322Tj@cluster0.evkj0zu.mongodb.net/sangi?retryWrites=true&w=majority";
async function main() {
    await mongoose_1.default.connect(MONGODB_URI);
    console.log("Connected to MongoDB.");
    const User = mongoose_1.default.model('User', new mongoose_1.default.Schema({ fullName: String, role: String }));
    const StaffProfile = mongoose_1.default.model('StaffProfile', new mongoose_1.default.Schema({ userId: mongoose_1.default.Schema.Types.ObjectId, kycStatus: String }));
    const users = await User.find({ role: 'staff' });
    console.log(`Found ${users.length} staff users:`);
    for (const user of users) {
        console.log(`- User: ${user.fullName} (${user._id})`);
        const profile = await StaffProfile.findOneAndUpdate({ userId: user._id }, { kycStatus: 'approved' }, { new: true, upsert: true });
        console.log(`  Updated StaffProfile (${profile._id}) -> kycStatus: 'approved'`);
    }
    await mongoose_1.default.disconnect();
    console.log("Done!");
}
main().catch(err => {
    console.error(err);
    process.exit(1);
});
//# sourceMappingURL=approve_staff.js.map