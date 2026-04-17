import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { type Resolver, useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cronjobToForm } from "@/lib/api";
import type { Cronjob, CronjobFormValues } from "@/types";

const FOURTEEN_MINUTES_MS = 840_000;

const formSchema = z
  .object({
    title: z.string().min(1, "Title is required."),
    url: z.string().url("Enter a valid URL."),
    method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]),
    headersText: z.string().refine((value) => {
      try {
        const parsed = JSON.parse(value || "{}") as unknown;
        return !!parsed && typeof parsed === "object" && !Array.isArray(parsed);
      } catch {
        return false;
      }
    }, "Headers must be a JSON object."),
    body: z.string(),
    minIntervalMs: z.coerce.number().int().positive(),
    maxIntervalMs: z.coerce.number().int().positive().max(FOURTEEN_MINUTES_MS, "Max interval cannot exceed 14 minutes."),
    timeoutMs: z.coerce.number().int().positive(),
    maxRetries: z.coerce.number().int().positive(),
    enabled: z.boolean(),
    allowNon2xx: z.boolean(),
    alertToEmail: z.string(),
    alertFromEmail: z.string(),
  })
  .refine((value) => value.minIntervalMs <= value.maxIntervalMs, {
    path: ["minIntervalMs"],
    message: "Min interval must be less than or equal to max interval.",
  })
  .refine((value) => !["GET", "HEAD"].includes(value.method) || !value.body.trim(), {
    path: ["body"],
    message: "GET and HEAD requests cannot include a body.",
  });

export function CronjobFormDialog({
  open,
  onOpenChange,
  cronjob,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cronjob?: Cronjob | null;
  onSubmit: (values: CronjobFormValues) => Promise<void>;
}) {
  const form = useForm<CronjobFormValues>({
    resolver: zodResolver(formSchema) as Resolver<CronjobFormValues>,
    defaultValues: cronjobToForm(cronjob ?? undefined),
  });

  useEffect(() => {
    if (open) {
      form.reset(cronjobToForm(cronjob ?? undefined));
    }
  }, [cronjob, form, open]);

  const submit = form.handleSubmit(async (values) => {
    await onSubmit(values);
    onOpenChange(false);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{cronjob ? "Edit cronjob" : "Create cronjob"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={submit} className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <FormField control={form.control} name="title" render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl><Input placeholder="Production health check" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="url" render={({ field }) => (
                <FormItem>
                  <FormLabel>URL</FormLabel>
                  <FormControl><Input placeholder="https://example.com/health" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="method" render={({ field }) => (
                <FormItem>
                  <FormLabel>Method</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      {["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"].map((method) => (
                        <SelectItem key={method} value={method}>{method}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="timeoutMs" render={({ field }) => (
                <FormItem>
                  <FormLabel>Timeout</FormLabel>
                  <FormControl><Input type="number" {...field} /></FormControl>
                  <FormDescription>Milliseconds.</FormDescription>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="minIntervalMs" render={({ field }) => (
                <FormItem>
                  <FormLabel>Min interval</FormLabel>
                  <FormControl><Input type="number" {...field} /></FormControl>
                  <FormDescription>Milliseconds.</FormDescription>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="maxIntervalMs" render={({ field }) => (
                <FormItem>
                  <FormLabel>Max interval</FormLabel>
                  <FormControl><Input type="number" {...field} /></FormControl>
                  <FormDescription>Hard-capped at 840000 ms.</FormDescription>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="maxRetries" render={({ field }) => (
                <FormItem>
                  <FormLabel>Max retries</FormLabel>
                  <FormControl><Input type="number" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="alertToEmail" render={({ field }) => (
                <FormItem>
                  <FormLabel>Alert email</FormLabel>
                  <FormControl><Input placeholder="ops@example.com" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <FormField control={form.control} name="headersText" render={({ field }) => (
              <FormItem>
                <FormLabel>Headers</FormLabel>
                <FormControl><Textarea className="font-mono" rows={5} {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="body" render={({ field }) => (
              <FormItem>
                <FormLabel>Request body</FormLabel>
                <FormControl><Textarea className="font-mono" rows={5} {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <div className="grid gap-4 md:grid-cols-2">
              <FormField control={form.control} name="enabled" render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-md border p-3">
                  <div><FormLabel>Enable immediately</FormLabel><FormDescription>Start scheduling after save.</FormDescription></div>
                  <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="allowNon2xx" render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-md border p-3">
                  <div><FormLabel>Allow non-2xx</FormLabel><FormDescription>Treat HTTP errors as successful runs.</FormDescription></div>
                  <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                </FormItem>
              )} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit">{cronjob ? "Save changes" : "Create cronjob"}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
