"use client"

import { Loader2 } from "lucide-react"
import { usePathname, useRouter } from "next/navigation"
import { useEffect } from "react"
import { useAuth } from "@/contexts/auth-context"

export function AuthGuard({ children }: { children: React.ReactNode }) {
    const { user, loading } = useAuth()
    const router = useRouter()
    const pathname = usePathname()

    useEffect(() => {
        // Check if user is authenticated or if current path is login page
        // Handles localized paths like /en/login or /login
        const isLoginPage =
            pathname?.endsWith("/login") || pathname?.endsWith("/login/")

        if (!loading && !user && !isLoginPage) {
            router.push("/login") // Middleware or next.config.js should handle locale redirect if needed
            // OR specifically router.push(`/${currentLang}/login`) if we had access to lang
        }
    }, [user, loading, router, pathname])

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        )
    }

    const isLoginPage =
        pathname?.endsWith("/login") || pathname?.endsWith("/login/")
    if (!user && !isLoginPage) {
        return null // Will redirect via useEffect
    }

    return <>{children}</>
}
