<script lang="ts">
	import { onMount } from 'svelte';
	import { selectionClick } from '$lib/utils/haptics';

	interface Props {
		cardId?: number;
		revision?: number;
		class?: string;
	}

	let { cardId, revision = 0, class: className = '' }: Props = $props();

	let canvasElement = $state<HTMLCanvasElement | null>(null);
	let isDrawing = $state(false);
	let hasStrokes = $state(false);
	let lastX = 0;
	let lastY = 0;

	// Clear canvas when cardId or revision changes
	let prevCardId: number | undefined = undefined;
	let prevRevision: number | undefined = undefined;

	$effect(() => {
		if (prevCardId === undefined && prevRevision === undefined) {
			prevCardId = cardId;
			prevRevision = revision;
			return;
		}
		if (cardId !== prevCardId || revision !== prevRevision) {
			prevCardId = cardId;
			prevRevision = revision;
			clearCanvas(false);
		}
	});

	function setupCanvas(): void {
		if (!canvasElement) return;
		const rect = canvasElement.getBoundingClientRect();
		const dpr = window.devicePixelRatio || 1;

		canvasElement.width = Math.floor(rect.width * dpr);
		canvasElement.height = Math.floor(rect.height * dpr);

		const ctx = canvasElement.getContext('2d');
		if (ctx) {
			ctx.scale(dpr, dpr);
			ctx.lineCap = 'round';
			ctx.lineJoin = 'round';
		}
	}

	export function clearCanvas(haptic = true): void {
		if (haptic) selectionClick();
		if (!canvasElement) return;
		const ctx = canvasElement.getContext('2d');
		if (!ctx) return;
		ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);
		hasStrokes = false;
	}

	function getPointerPos(e: PointerEvent): { x: number; y: number; pressure: number } {
		if (!canvasElement) return { x: 0, y: 0, pressure: 0.5 };
		const rect = canvasElement.getBoundingClientRect();
		const x = e.clientX - rect.left;
		const y = e.clientY - rect.top;
		// iPad Apple Pencil provides pressure between 0.0 and 1.0; fallback to 0.5 if not supported
		const pressure = e.pressure > 0 ? e.pressure : 0.5;
		return { x, y, pressure };
	}

	function getStrokeColor(): string {
		if (typeof document !== 'undefined' && document.documentElement.classList.contains('dark')) {
			return '#f3ede2'; // Warm hanji light ink in dark mode
		}
		return '#22201e'; // Sumi ink charcoal black in light mode
	}

	function drawLine(
		ctx: CanvasRenderingContext2D,
		fromX: number,
		fromY: number,
		toX: number,
		toY: number,
		pressure: number
	): void {
		ctx.beginPath();
		ctx.moveTo(fromX, fromY);
		ctx.lineTo(toX, toY);
		ctx.strokeStyle = getStrokeColor();
		// Scale stroke width dynamically based on stylus pressure (2px to 5px)
		ctx.lineWidth = Math.max(1.8, Math.min(5.5, 2.5 + pressure * 2.8));
		ctx.stroke();
	}

	function handlePointerDown(e: PointerEvent): void {
		if (!canvasElement) return;
		canvasElement.setPointerCapture(e.pointerId);
		isDrawing = true;
		hasStrokes = true;

		const pos = getPointerPos(e);
		lastX = pos.x;
		lastY = pos.y;

		// Draw initial dot
		const ctx = canvasElement.getContext('2d');
		if (ctx) {
			drawLine(ctx, pos.x, pos.y, pos.x + 0.1, pos.y + 0.1, pos.pressure);
		}
	}

	function handlePointerMove(e: PointerEvent): void {
		if (!isDrawing || !canvasElement) return;
		const ctx = canvasElement.getContext('2d');
		if (!ctx) return;

		// On iPad Safari, Apple Pencil can dispatch coalesced events for higher precision
		const events =
			typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [e];

		for (const ev of events) {
			const pos = getPointerPos(ev);
			drawLine(ctx, lastX, lastY, pos.x, pos.y, pos.pressure);
			lastX = pos.x;
			lastY = pos.y;
		}
	}

	function handlePointerUp(e: PointerEvent): void {
		if (!isDrawing) return;
		isDrawing = false;
		if (canvasElement && canvasElement.hasPointerCapture(e.pointerId)) {
			canvasElement.releasePointerCapture(e.pointerId);
		}
	}

	onMount(() => {
		setupCanvas();

		const resizeObserver = new ResizeObserver(() => {
			setupCanvas();
		});

		if (canvasElement) {
			resizeObserver.observe(canvasElement);
		}

		return () => {
			resizeObserver.disconnect();
		};
	});
</script>

<div
	class="relative flex flex-col overflow-hidden rounded-2xl border border-border-subtle bg-surface/90 shadow-xs backdrop-blur-xs {className}"
>
	<!-- Scratchpad Header bar -->
	<div
		class="flex items-center justify-between border-b border-border-subtle/60 px-3 py-1.5 select-none bg-canvas/40"
	>
		<div class="flex items-center gap-1.5 text-ink-secondary">
			<svg
				class="h-3.5 w-3.5 text-primary"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				aria-hidden="true"
			>
				<path d="M12 20h9" />
				<path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
			</svg>
			<span class="text-[11px] font-bold tracking-wider uppercase text-ink-muted">
				연습장 · Scratch Pad
			</span>
			<span class="text-[10px] text-ink-muted/80 hidden sm:inline">(Apple Pencil / Stylus)</span>
		</div>

		<button
			type="button"
			onclick={() => clearCanvas(true)}
			class="flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold transition active:scale-95 {hasStrokes
				? 'text-primary hover:bg-primary/10'
				: 'text-ink-muted hover:text-ink-secondary'}"
			title="지우기 (Clear)"
		>
			<svg
				class="h-3 w-3"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				aria-hidden="true"
			>
				<path d="M3 6h18" />
				<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
				<path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
			</svg>
			<span>지우기</span>
		</button>
	</div>

	<!-- Canvas Area with subtle Korean manuscript block / grid guidelines -->
	<div class="relative w-full h-44 sm:h-52 bg-surface">
		<!-- Subtle background grid lines for Hangul syllable spacing -->
		<div
			class="pointer-events-none absolute inset-0 opacity-[0.06] bg-[radial-gradient(#22201e_1px,transparent_1px)] dark:bg-[radial-gradient(#f3ede2_1px,transparent_1px)] [background-size:24px_24px]"
		></div>

		<canvas
			bind:this={canvasElement}
			onpointerdown={handlePointerDown}
			onpointermove={handlePointerMove}
			onpointerup={handlePointerUp}
			onpointercancel={handlePointerUp}
			onpointerleave={handlePointerUp}
			class="relative h-full w-full cursor-crosshair touch-none select-none"
			style="touch-action: none;"
		></canvas>

		{#if !hasStrokes}
			<div
				class="pointer-events-none absolute inset-0 flex items-center justify-center select-none opacity-40 text-ink-muted"
			>
				<p class="text-xs text-center font-medium">
					펜으로 한글을 써보세요<br />
					<span class="text-[10px]">Sketch or write your answer with Apple Pencil</span>
				</p>
			</div>
		{/if}
	</div>
</div>
