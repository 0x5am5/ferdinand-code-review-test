import { zodResolver } from "@hookform/resolvers/zod";
import {
	type Client,
	type InsertClient,
	insertClientSchema,
} from "@shared/schema";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

export default function Instances() {
	const { data: clients } = useQuery<Client[]>({
		queryKey: ["/api/clients"],
	});

	const { toast } = useToast();
	const form = useForm({
		resolver: zodResolver(insertClientSchema),
		defaultValues: {
			name: "",
			description: "",
		},
	});

	const createClient = useMutation({
		mutationFn: async (data: InsertClient) => {
			await apiRequest("POST", "/api/clients", data);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
			toast({
				title: "Success",
				description: "Client instance created",
			});
			form.reset();
		},
	});

	return (
		<div className="p-8">
			<div className="flex justify-between items-center mb-8">
				<h1 className="text-4xl font-bold">Client Instances</h1>

				<Dialog>
					<DialogTrigger asChild>
						<Button>
							<Plus className="mr-2 h-4 w-4" />
							New Instance
						</Button>
					</DialogTrigger>
					<DialogContent>
						<DialogHeader>
							<DialogTitle>Create Client Instance</DialogTitle>
						</DialogHeader>

						<Form {...form}>
							<form
								onSubmit={form.handleSubmit((data) =>
									createClient.mutate(data),
								)}
								className="space-y-4"
							>
								<FormField
									control={form.control}
									name="name"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Name</FormLabel>
											<FormControl>
												<Input {...field} />
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>

								<FormField
									control={form.control}
									name="description"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Description</FormLabel>
											<FormControl>
												<Textarea {...field} />
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>

								<Button
									type="submit"
									className="w-full"
									disabled={createClient.isPending}
								>
									Create Instance
								</Button>
							</form>
						</Form>
					</DialogContent>
				</Dialog>
			</div>

			<div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
				{clients?.map((client) => (
					<Card key={client.id}>
						<CardHeader>
							<CardTitle>{client.name}</CardTitle>
							<CardDescription>{client.description}</CardDescription>
						</CardHeader>
						<CardContent>
							<p className="text-sm text-muted-foreground">
								Created{" "}
								{client.createdAt
									? new Date(client.createdAt).toLocaleDateString()
									: "N/A"}
							</p>
						</CardContent>
					</Card>
				))}
			</div>
		</div>
	);
}
