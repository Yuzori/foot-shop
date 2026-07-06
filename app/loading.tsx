import { Container } from "@/components/ui/container";
import { Spinner } from "@/components/ui/spinner";

export default function Loading() {
  return (
    <Container className="flex min-h-[60vh] items-center justify-center">
      <Spinner className="h-7 w-7" />
    </Container>
  );
}
