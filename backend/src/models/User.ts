import { Schema, model, models, type HydratedDocument, type Model } from "mongoose";

export interface IUser {
  email: string;
  passwordHash: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const userSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false }
  },
  { timestamps: true, versionKey: false }
);

export type UserDocument = HydratedDocument<IUser>;
export const User: Model<IUser> = (models.User as Model<IUser> | undefined) ?? model<IUser>("User", userSchema);
