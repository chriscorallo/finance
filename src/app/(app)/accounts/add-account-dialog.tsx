"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Plus } from "lucide-react";
import { createAccountAction, type AccountActionState } from "@/app/(app)/accounts/actions";
import { ACCOUNT_TYPE_META } from "@/lib/finance/account-type-meta";
import type { AccountType } from "@/lib/supabase/database.types";
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

const LIABILITY_TYPES = new Set<AccountType>([
  "credit_card",
  "loan_personal",
  "loan_student",
  "loan_mortgage",
  "loan_auto",
  "other_liability",
]);

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : "Add account"}
    </Button>
  );
}

export function AddAccountDialog() {
  const [open, setOpen] = useState(false);
  const [accountType, setAccountType] = useState<AccountType>("checking");
  const [state, formAction] = useActionState<AccountActionState, FormData>(async (prevState, formData) => {
    const result = await createAccountAction(prevState, formData);
    if (!result) {
      setOpen(false);
    }
    return result;
  }, null);

  const isLiability = LIABILITY_TYPES.has(accountType);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button className="w-full gap-2 sm:w-auto" />}>
        <Plus className="size-4" /> Add account
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add account</DialogTitle>
          <DialogDescription>Enter the current balance yourself — this is a manually tracked account.</DialogDescription>
        </DialogHeader>

        <form action={formAction} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" placeholder="e.g. Chase Checking" required maxLength={100} />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="accountType">Type</Label>
            <Select value={accountType} onValueChange={(value) => setAccountType(value as AccountType)}>
              <SelectTrigger id="accountType" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.entries(ACCOUNT_TYPE_META) as [AccountType, (typeof ACCOUNT_TYPE_META)[AccountType]][]).map(
                  ([value, meta]) => (
                    <SelectItem key={value} value={value}>
                      {meta.label}
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
            {/* Select's own value isn't form-submitted here since we drive it from accountType state directly */}
            <input type="hidden" name="accountType" value={accountType} />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="balance">{isLiability ? "Current balance owed" : "Current balance"}</Label>
            <Input id="balance" name="balance" inputMode="decimal" placeholder="1,234.56" required />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="mask">Last 4 digits (optional)</Label>
            <Input id="mask" name="mask" maxLength={4} placeholder="1234" className="max-w-32" />
          </div>

          {isLiability ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="interestRate">Interest rate % (optional)</Label>
                <Input id="interestRate" name="interestRate" inputMode="decimal" placeholder="19.99" />
              </div>
              {accountType === "credit_card" ? (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="creditLimit">Credit limit (optional)</Label>
                  <Input id="creditLimit" name="creditLimit" inputMode="decimal" placeholder="5,000" />
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="flex flex-col gap-3">
            <div className="flex items-start gap-2">
              <Checkbox id="includeInNetWorth" name="includeInNetWorth" defaultChecked className="mt-0.5" />
              <Label htmlFor="includeInNetWorth" className="font-normal">
                Include in net worth
              </Label>
            </div>
            <div className="flex items-start gap-2">
              <Checkbox id="includeInLiquidNetWorth" name="includeInLiquidNetWorth" defaultChecked={!isLiability} className="mt-0.5" />
              <Label htmlFor="includeInLiquidNetWorth" className="font-normal">
                Include in liquid net worth (cash you could access quickly)
              </Label>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Input id="notes" name="notes" maxLength={1000} />
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
