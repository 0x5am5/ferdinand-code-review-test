import { zodResolver } from "@hookform/resolvers/zod";
import {
	type Client,
	type InviteUserForm,
	inviteUserSchema,
	type User,
	UserRole,
} from "@shared/schema";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
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
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface InviteUserDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	currentUser: User;
	clients: Client[];
}

export function InviteUserDialog({
	open,
	onOpenChange,
	currentUser,
	clients,
}: InviteUserDialogProps) {
	const { toast } = useToast();

	// Get available roles based on current user's role
	const getAvailableRoles = () => {
		if (currentUser?.role === UserRole.SUPER_ADMIN) {
			return Object.values(UserRole);
		} else if (currentUser?.role === UserRole.ADMIN) {
			return [
				UserRole.ADMIN,
				UserRole.STANDARD,
				UserRole.GUEST,
				UserRole.EDITOR,
			];
		}
		return [];
	};

	const inviteForm = useForm<InviteUserForm>({
		resolver: zodResolver(inviteUserSchema),
		defaultValues: {
			email: "",
			name: "",
			role: UserRole.STANDARD,
			clientIds: [],
		},
	});

	const inviteUser = useMutation({
		mutationFn: async (data: InviteUserForm) => {
			try {
				const response = await apiRequest("POST", "/api/users", data);
				return response;
			} catch (err: unknown) {
				if (err instanceof Error && "response" in err) {
					const response = (
						err as {
							response?: {
								data?: {
									code?: string;
									message?: string;
									invitationId?: string;
								};
							};
						}
					).response;
					if (response?.data) {
						if (response.data.code === "EMAIL_EXISTS") {
							throw new Error("A user with this email already exists.");
						} else if (response.data.code === "INVITATION_EXISTS") {
							const customError = new Error(
								"An invitation for this email already exists. Would you like to resend it?",
							);
							(customError as Error & { invitationId?: string }).invitationId =
								response.data.invitationId;
							throw customError;
						}
						if (response.data.message) {
							throw new Error(response.data.message);
						}
					}
				}
				throw err;
			}
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["/api/users"] });
			queryClient.invalidateQueries({ queryKey: ["/api/invitations"] });
			toast({
				title: "Success",
				description: "User invited successfully",
			});
			onOpenChange(false);
			inviteForm.reset();
		},
		onError: (error: Error) => {
			toast({
				title: "Error",
				description: error.message,
				variant: "destructive",
			});
		},
	});

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Invite New User</DialogTitle>
					<DialogDescription>
						Send an invitation to a new user to join the platform.
					</DialogDescription>
				</DialogHeader>

				<Form {...inviteForm}>
					<form
						onSubmit={inviteForm.handleSubmit((data) =>
							inviteUser.mutate(data),
						)}
						className="space-y-4"
					>
						<FormField
							control={inviteForm.control}
							name="name"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Name</FormLabel>
									<FormControl>
										<Input placeholder="John Doe" {...field} />
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						<FormField
							control={inviteForm.control}
							name="email"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Email</FormLabel>
									<FormControl>
										<Input placeholder="john@example.com" {...field} />
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						<FormField
							control={inviteForm.control}
							name="role"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Role</FormLabel>
									<Select
										onValueChange={field.onChange}
										defaultValue={field.value}
									>
										<FormControl>
											<SelectTrigger>
												<SelectValue placeholder="Select a role" />
											</SelectTrigger>
										</FormControl>
										<SelectContent>
											{getAvailableRoles().map((role) => (
												<SelectItem key={role} value={role}>
													{role.replace("_", " ")}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
									<FormMessage />
								</FormItem>
							)}
						/>

						{currentUser?.role === UserRole.SUPER_ADMIN && (
							<FormField
								control={inviteForm.control}
								name="clientIds"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Assign Clients</FormLabel>
										<div className="max-h-40 overflow-y-auto space-y-2 border rounded-md p-2">
											{clients.map((client) => (
												<div
													key={client.id}
													className="flex items-center space-x-2 bg-white z-30"
												>
													<Checkbox
														id={`client-${client.id}`}
														checked={field.value?.includes(client.id)}
														onCheckedChange={(checked: boolean) => {
															const newValue = [...(field.value || [])];
															if (checked) {
																newValue.push(client.id);
															} else {
																const index = newValue.indexOf(client.id);
																if (index !== -1) newValue.splice(index, 1);
															}
															field.onChange(newValue);
														}}
													/>
													<label
														htmlFor={`client-${client.id}`}
														className="text-sm cursor-pointer"
													>
														{client.name}
													</label>
												</div>
											))}

											{clients.length === 0 && (
												<div className="text-center p-2 text-muted-foreground">
													No clients available to assign
												</div>
											)}
										</div>
										<FormMessage />
									</FormItem>
								)}
							/>
						)}

						<DialogFooter>
							<Button type="submit" disabled={inviteUser.isPending}>
								{inviteUser.isPending ? "Sending..." : "Send Invitation"}
							</Button>
						</DialogFooter>
					</form>
				</Form>
			</DialogContent>
		</Dialog>
	);
}
