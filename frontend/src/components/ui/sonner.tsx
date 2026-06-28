"use client"

import {
  CheckCircleIcon,
  InfoIcon,
  SpinnerGapIcon,
  WarningCircleIcon,
  XCircleIcon,
} from "@phosphor-icons/react"
import type { CSSProperties } from "react"
import { Toaster as Sonner, type ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme={props.theme ?? "light"}
      className="toaster group"
      icons={{
        success: <CheckCircleIcon className="size-4" weight="light" />,
        info: <InfoIcon className="size-4" weight="light" />,
        warning: <WarningCircleIcon className="size-4" weight="light" />,
        error: <XCircleIcon className="size-4" weight="light" />,
        loading: <SpinnerGapIcon className="size-4 animate-spin" weight="light" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
