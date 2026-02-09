"use client"

import {
    GoogleAuthProvider,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    signInWithPopup,
    signOut,
    type User,
} from "firebase/auth"
import { useRouter } from "next/navigation"
import { createContext, useContext, useEffect, useState } from "react"
import { auth } from "@/lib/firebase"

interface AuthContextType {
    user: User | null
    loading: boolean
    signInWithGoogle: () => Promise<void>
    logout: () => Promise<void>
    googleAccessToken: string | null
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null)
    const [loading, setLoading] = useState(true)
    const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(
        null,
    )
    const router = useRouter()

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setUser(user)
            setLoading(false)
        })

        const storedToken = sessionStorage.getItem("googleAccessToken")
        if (storedToken) {
            setGoogleAccessToken(storedToken)
        }

        return () => unsubscribe()
    }, [])

    const signInWithGoogle = async () => {
        try {
            const provider = new GoogleAuthProvider()
            provider.addScope("https://www.googleapis.com/auth/drive.file")
            provider.addScope(
                "https://www.googleapis.com/auth/drive.metadata.readonly",
            )
            const result = await signInWithPopup(auth, provider)
            const credential = GoogleAuthProvider.credentialFromResult(result)
            if (credential?.accessToken) {
                setGoogleAccessToken(credential.accessToken)
                sessionStorage.setItem(
                    "googleAccessToken",
                    credential.accessToken,
                )
            }
            router.push("/") // Redirect to home after login
        } catch (error) {
            console.error("Error signing in with Google", error)
            throw error
        }
    }

    const logout = async () => {
        try {
            await signOut(auth)
            setGoogleAccessToken(null)
            sessionStorage.removeItem("googleAccessToken")
            router.push("/login")
        } catch (error) {
            console.error("Error signing out", error)
            throw error
        }
    }

    return (
        <AuthContext.Provider
            value={{
                user,
                loading,
                signInWithGoogle,
                logout,
                googleAccessToken,
            }}
        >
            {!loading && children}
        </AuthContext.Provider>
    )
}

export function useAuth() {
    const context = useContext(AuthContext)
    if (context === undefined) {
        throw new Error("useAuth must be used within an AuthProvider")
    }
    return context
}
