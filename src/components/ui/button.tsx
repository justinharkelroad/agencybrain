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
        ghost: "bg-transparent border border-border/20 text-foreground/80 hover:bg-muted/5 hover:text-foreground hover:border-border/30 active:scale-[0.98] active:bg-muted/10 transition-all duration-150",
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
  isHeaderButton?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, showIcon = false, isHeaderButton = false, children, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    
    // For header buttons: use existing variant system with special styling
    if (isHeaderButton) {
      return (
        <Comp
          className={cn(buttonVariants({ variant, size }), className)}
          ref={ref}
          {...props}
        >
          {children}
          {showIcon && <ArrowUpRight className="w-3.5 h-3.5" />}
        </Comp>
      )
    }
    
    // For ghost variant: use transparent style (don't override)
    if (variant === "ghost") {
      return (
        <Comp
          className={cn(buttonVariants({ variant: "ghost", size }), className)}
          ref={ref}
          {...props}
        >
          {children}
          {showIcon && <ArrowUpRight className="w-3.5 h-3.5" />}
        </Comp>
      )
    }
    
    // For non-header, non-ghost buttons: white pill style
    const pillBaseClasses = cn(
      "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium",
      "ring-offset-background transition-all duration-200",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      "disabled:cursor-not-allowed disabled:bg-white disabled:text-black disabled:opacity-100",
      "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
      "rounded-full bg-white text-black shadow-sm hover:shadow-md",
      "border border-gray-200"
    )
    
    const sizeClasses = {
      default: "h-10 px-4 py-2",
      sm: "h-9 px-3",
      lg: "h-11 px-8",
      icon: "h-10 w-10"
    }[size || "default"]
    
    if (asChild) {
      return (
        <Comp
          className={cn(pillBaseClasses, sizeClasses, className)}
          ref={ref}
          {...props}
        >
          {children}
        </Comp>
      )
    }
    
    return (
      <Comp
        className={cn(pillBaseClasses, sizeClasses, className)}
        ref={ref}
        {...props}
      >
        {children}
        {showIcon && <ArrowUpRight className="w-3.5 h-3.5" />}
      </Comp>
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
