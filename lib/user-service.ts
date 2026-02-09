import type { User } from "firebase/auth"
import { doc, getDoc, setDoc } from "firebase/firestore"
import { firestore } from "./firebase"

export type UserRole = "admin" | "user"

export interface UserProfile {
    uid: string
    email: string | null
    displayName: string | null
    photoURL: string | null
    role: UserRole
    createdAt: number
    lastLoginAt: number
}

export async function getUserRole(userId: string): Promise<UserRole> {
    try {
        const userRef = doc(firestore, "users", userId)
        const userSnap = await getDoc(userRef)

        if (userSnap.exists()) {
            return (userSnap.data()?.role as UserRole) || "user"
        }
    } catch (error) {
        console.error("Error fetching user role:", error)
    }
    return "user"
}

export async function ensureUserDocument(user: User): Promise<UserRole> {
    if (!user.uid) return "user"

    const userRef = doc(firestore, "users", user.uid)

    try {
        const userSnap = await getDoc(userRef)

        if (userSnap.exists()) {
            // Update last login
            await setDoc(
                userRef,
                {
                    lastLoginAt: Date.now(),
                    email: user.email, // Keep email updated
                    displayName: user.displayName,
                    photoURL: user.photoURL,
                },
                { merge: true },
            )

            return (userSnap.data().role as UserRole) || "user"
        } else {
            // Create new user doc
            const newUser: UserProfile = {
                uid: user.uid,
                email: user.email,
                displayName: user.displayName,
                photoURL: user.photoURL,
                role: "user", // Default role
                createdAt: Date.now(),
                lastLoginAt: Date.now(),
            }

            // We can't write to 'users' via client SDK if rules block it?
            // Wait, I set write: if false in rules.
            // Ah, the Implementation Plan said "Create user doc on login".
            // If rules say "allow write: if false", the client CANNOT create the document.
            // I need to allow users to create/update THEIR OWN document.
            // Let me fix the rules in the next step or right now?
            // Actually, I should fix the rules to allow users to write their own doc.

            // For now, I'll write the code assuming rules will allow it.
            await setDoc(userRef, newUser)
            return "user"
        }
    } catch (error) {
        console.error("Error ensuring user document:", error)
        return "user"
    }
}
