"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Plus } from "lucide-react";
import { createEventAction } from "@/app/(app)/schedule/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";

export type ConnectionOption = { id: string; label: string };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Adding…" : "Add event"}
    </Button>
  );
}

export function AddEventDialog({ connections }: { connections: ConnectionOption[] }) {
  const [open, setOpen] = useState(false);
  const [connectionId, setConnectionId] = useState(connections[0]?.id ?? "");
  const [state, formAction] = useActionState<{ error: string } | null, FormData>(async (prevState, formData) => {
    const result = await createEventAction(prevState, formData);
    if (!result) setOpen(false);
    return result;
  }, null);

  if (connections.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button className="w-full gap-2 sm:w-auto" />}>
        <Plus className="size-4" /> Add event
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add event</DialogTitle>
          <DialogDescription>Pick which connected calendar this goes on.</DialogDescription>
        </DialogHeader>

        <form action={formAction} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="event-calendar">Calendar</Label>
            <Select value={connectionId} onValueChange={(value) => setConnectionId(value ?? "")}>
              <SelectTrigger id="event-calendar" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {connections.map((connection) => (
                  <SelectItem key={connection.id} value={connection.id}>
                    {connection.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <input type="hidden" name="connectionId" value={connectionId} />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="event-title">Title</Label>
            <Input id="event-title" name="title" required maxLength={200} />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="event-start">Starts</Label>
              <Input id="event-start" name="startAt" type="datetime-local" required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="event-end">Ends</Label>
              <Input id="event-end" name="endAt" type="datetime-local" required />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox id="event-all-day" name="allDay" />
            <Label htmlFor="event-all-day" className="font-normal">
              All day
            </Label>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="event-location">Location (optional)</Label>
            <Input id="event-location" name="location" maxLength={200} />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="event-description">Description (optional)</Label>
            <Input id="event-description" name="description" maxLength={1000} />
          </div>

          {state?.error ? (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          ) : null}

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
            <SubmitButton />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
