import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { ArrowUpRight } from "lucide-react"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-smooth focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "relative overflow-hidden bg-zinc-900 dark:bg-zinc-100 transition-all duration-200 group shadow-elegant",
        destructive:
          "relative overflow-hidden bg-destructive text-destructive-foreground transition-all duration-200 group",
        outline:
          "relative overflow-hidden border border-input bg-background transition-all duration-200 group",
        secondary:
          "relative overflow-hidden bg-secondary text-secondary-foreground transition-all duration-200 group",
        ghost: "relative overflow-hidden transition-all duration-200 group",
        link: "relative overflow-hidden text-primary underline-offset-4 hover:underline transition-all duration-200 group",
        premium: "relative overflow-hidden gradient-primary text-primary-foreground transition-all duration-200 group shadow-elegant",
        glass: "relative overflow-hidden glass-surface text-foreground transition-all duration-200 group",
        "gradient-glow": "relative overflow-hidden text-white font-semibold transition-all duration-200 group",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  showIcon?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, showIcon = false, children, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    
    // When asChild is true, render children directly to satisfy Slot's single-child requirement
    if (asChild) {
      return (
        <Comp
          className={cn(buttonVariants({ variant, size, className }))}
          ref={ref}
          {...props}
        >
          {children}
        </Comp>
      )
    }
    
    // Regular button - ALL variants get gradient effect
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      >
        {/* Gradient background for ALL buttons */}
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 opacity-40 group-hover:opacity-80 blur transition-opacity duration-500" />
        
        {/* Content wrapper - text color varies by variant */}
        <div className={cn(
          "relative flex items-center justify-center gap-2",
          (variant === "default" || variant === "gradient-glow" || variant === undefined) && "text-white dark:text-zinc-900",
          variant === "outline" && "text-foreground",
          variant === "ghost" && "text-foreground",
          variant === "glass" && "text-foreground"
        )}>
          {children}
          {showIcon && <ArrowUpRight className="w-3.5 h-3.5" />}
        </div>
      </Comp>
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
