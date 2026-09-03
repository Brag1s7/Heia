/**
 * @format
 *
 * KOMMENTARSKJERMEN (fra varsel/deeplink) — samme tastatureier som arkene:
 * trådens dokk. Skjermen har INGEN KeyboardAvoidingView (én eier).
 */
import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';
import {KeyboardAvoidingView, Text} from 'react-native';

jest.mock('../src/components', () => ({
  BackBar: () => null,
  DaylightGround: () => null,
}));
jest.mock('../src/components/CommentThread', () => {
  const {Text: MockText} = require('react-native');
  return {
    CommentThread: (props: {
      postId: string;
      onOpenMatch?: (id: string) => void;
    }) => (
      <MockText onPress={() => props.onOpenMatch?.('ev-1')}>
        TRÅD:{props.postId}
      </MockText>
    ),
  };
});

import {CommentsScreen} from '../src/screens/CommentsScreen';

it('rammen: ingen KeyboardAvoidingView — dokken i tråden eier tastaturet; «Se kampen» navigerer', () => {
  const navigate = jest.fn();
  let tree!: ReactTestRenderer.ReactTestRenderer;
  act(() => {
    tree = ReactTestRenderer.create(
      <CommentsScreen
        route={{params: {postId: 'p1', teamSpaceId: 'ts1'}} as never}
        navigation={{navigate, goBack: jest.fn()} as never}
      />,
    );
  });
  expect(tree.root.findAllByType(KeyboardAvoidingView)).toHaveLength(0);
  const thread = tree.root.findByType(Text);
  expect(String(thread.props.children.join(''))).toBe('TRÅD:p1');
  act(() => thread.props.onPress());
  expect(navigate).toHaveBeenCalledWith('EventDetail', {eventId: 'ev-1'});
  act(() => tree.unmount());
});
