import { Schema, model, models, type HydratedDocument } from "mongoose";

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
export const User = (models.User as ReturnType<typeof model<IUser>>) || model<IUser>("User", userSchema);
