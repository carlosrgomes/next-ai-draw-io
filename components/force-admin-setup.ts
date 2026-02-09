import { doc, setDoc } from "firebase/firestore"
import { auth, firestore } from "../lib/firebase"

async function forceCreateUserDoc() {
    if (!auth.currentUser) {
        console.log("Please login first!")
        return
    }
    const uid = auth.currentUser.uid
    console.log("Creating doc for user:", uid)

    try {
        const userRef = doc(firestore, "users", uid)
        await setDoc(
            userRef,
            {
                uid: uid,
                email: auth.currentUser.email,
                displayName: auth.currentUser.displayName,
                role: "admin", // FORCE ADMIN FOR ME
                createdAt: Date.now(),
                lastLoginAt: Date.now(),
            },
            { merge: true },
        )

        console.log("SUCCESS! User document created/updated with ADMIN role.")
        console.log("Please refresh the page.")
    } catch (e) {
        console.error("Error creating doc:", e)
    }
}

// Expose to window for easy calling from console
if (typeof window !== "undefined") {
    ;(window as any).setupAdmin = forceCreateUserDoc
}
console.log("Setup script loaded. Run `setupAdmin()` in console.")
