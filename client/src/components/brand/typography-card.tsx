import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface TypographyCardProps {
	name: string;
	family: string;
	weights: string[];
	specimen: string;
	url: string;
}

export function TypographyCard({
	name,
	family,
	weights,
	specimen,
	url,
}: TypographyCardProps) {
	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center justify-between">
					<span>{name}</span>
					<Button variant="ghost" size="icon" asChild>
						<a href={url} target="_blank" rel="noopener noreferrer">
							<ExternalLink className="h-4 w-4" />
						</a>
					</Button>
				</CardTitle>
			</CardHeader>
			<CardContent>
				<p className="text-muted-foreground mb-4">{weights.join(", ")}</p>
				<p className="text-xl" style={{ fontFamily: family }}>
					{specimen}
				</p>
			</CardContent>
		</Card>
	);
}
